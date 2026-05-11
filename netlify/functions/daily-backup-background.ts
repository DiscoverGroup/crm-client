/**
 * daily-backup-background — Netlify Background Function
 *
 * Background functions bypass Netlify's 10-second free-tier timeout.
 * They run for up to 15 minutes and return 202 Accepted immediately.
 * The actual backup work runs asynchronously after the 202 is sent.
 *
 * Manual trigger: POST /.netlify/functions/daily-backup-background
 *   Requires Authorization: Bearer <admin JWT>
 *   Client should poll /.netlify/functions/list-backups to detect completion.
 *
 * Scheduled trigger (cron): "0 2 * * *" — daily at 02:00 UTC
 *   Configured in netlify.toml under [functions."daily-backup-background"]
 *
 * Required env vars:
 *   MONGODB_URI
 *   R2_ENDPOINT
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME   (optional — falls back to 'crm-uploads')
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken } from './middleware/authMiddleware';
import { logInfo, logError, startTimer } from './utils/logger';
import { acquireJobLock, releaseJobLock, alreadyRunningResponse } from './utils/idempotency';

const MONGODB_URI   = process.env.MONGODB_URI              || '';
const DB_NAME       = 'dg_crm';
const R2_ENDPOINT   = process.env.R2_ENDPOINT              || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID         || '';
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY     || '';
const R2_BUCKET     = process.env.R2_BUCKET_NAME           || 'crm-uploads';

const COLLECTIONS = ['clients', 'users', 'log_notes', 'activity_logs', 'file_attachments', 'calendar_events', 'notifications'];

export const handler: Handler = async (event) => {
  const jsonHeaders = { 'Content-Type': 'application/json' };

  // For manual HTTP triggers, validate JWT before accepting the job.
  // Scheduled invocations have no body.
  const isScheduled = !event.body;

  if (!isScheduled) {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
    }
    const auth = verifyAuthToken(event.headers['authorization']);
    if (!auth.valid) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: 'Unauthorized — valid admin JWT required' }) };
    }
  }

  if (!MONGODB_URI || !R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'Missing env vars: MONGODB_URI, R2_ENDPOINT, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY' }),
    };
  }

  // Idempotency lock — prevents duplicate concurrent backup runs triggered by
  // rate-limit bypass or scheduler double-fire. Lock TTL matches max job duration.
  const dateLabel = new Date().toISOString().slice(0, 10);
  const lockId = `daily-backup:${dateLabel}`;
  let lockDb: MongoClient | null = null;
  let lockAcquired = false;
  try {
    lockDb = new MongoClient(MONGODB_URI);
    await lockDb.connect();
    const lock = await acquireJobLock(lockDb.db('dg_crm'), lockId, 900);
    if (!lock.acquired) {
      return alreadyRunningResponse(jsonHeaders);
    }
    lockAcquired = true;
  } catch {
    // If lock check fails, proceed — better to run twice than not at all for backup
  } finally {
    if (lockDb) { await lockDb.close(); lockDb = null; }
  }

  // Fire-and-forget the actual backup — runs after 202 is sent.
  runBackup(lockAcquired ? lockId : null).catch(() => {/* errors written to R2 status file */});

  return {
    statusCode: 202,
    headers: jsonHeaders,
    body: JSON.stringify({ accepted: true, message: 'Backup started — poll list-backups to track progress' }),
  };
};

async function runBackup(lockId: string | null): Promise<void> {
  const elapsed = startTimer();
  const dateLabel = new Date().toISOString().slice(0, 10);
  logInfo({ fn: 'daily-backup-background', msg: 'Background backup started', dateLabel });
  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });

  const mongo = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000, // Netlify US-East → Atlas Hong Kong needs more time
    connectTimeoutMS:         15000,
    socketTimeoutMS:          20000,
    tls: true,
    tlsAllowInvalidCertificates: false,
    retryWrites: false,
    retryReads: false,
    maxPoolSize: 1,
    minPoolSize: 0,
  });

  const results: Record<string, { count: number; path: string } | { error: string }> = {};

  const writeStatus = async (status: object) => {
    try {
      await s3.send(new PutObjectCommand({
        Bucket:      R2_BUCKET,
        Key:         `backups/${dateLabel}/status.json`,
        Body:        JSON.stringify(status, null, 2),
        ContentType: 'application/json',
      }));
    } catch {
      // Status write failures are non-fatal
    }
  };

  try {
    await writeStatus({ state: 'running', current: 'connecting', done: 0, total: COLLECTIONS.length, startedAt: new Date().toISOString(), date: dateLabel });

    await mongo.connect();
    const db = mongo.db(DB_NAME);

    // Write "in progress" status once before the parallel work starts
    await writeStatus({ state: 'running', current: 'all-collections', done: 0, total: COLLECTIONS.length, startedAt: new Date().toISOString(), date: dateLabel });

    // Back up all collections IN PARALLEL — significantly faster than sequential
    const colResults = await Promise.allSettled(
      COLLECTIONS.map(async (collectionName) => {
        const documents = await db.collection(collectionName).find({}).toArray();
        const cleanDocs = documents.map(({ _id, ...rest }) => rest);
        const r2Key = `backups/${dateLabel}/${collectionName}.json`;
        await s3.send(new PutObjectCommand({
          Bucket:      R2_BUCKET,
          Key:         r2Key,
          Body:        JSON.stringify(cleanDocs, null, 2),
          ContentType: 'application/json',
        }));
        return { collectionName, count: cleanDocs.length, path: r2Key };
      })
    );

    for (const result of colResults) {
      if (result.status === 'fulfilled') {
        const { collectionName, count, path } = result.value;
        results[collectionName] = { count, path };
      } else {
        // Find which collection failed — use index mapping
        const i = colResults.indexOf(result);
        const col = COLLECTIONS[i] ?? 'unknown';
        results[col] = { error: (result.reason as Error)?.message || 'Unknown error' };
      }
    }

    const manifest = {
      state:       'complete',
      timestamp:   new Date().toISOString(),
      date:        dateLabel,
      collections: results,
    };

    // Write manifest — always written even if some collections errored
    await s3.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         `backups/${dateLabel}/manifest.json`,
      Body:        JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }));

    await writeStatus({ state: 'complete', done: COLLECTIONS.length, total: COLLECTIONS.length, completedAt: new Date().toISOString(), date: dateLabel });
    logInfo({ fn: 'daily-backup-background', msg: 'Background backup complete', durationMs: elapsed() });
  } catch (err: any) {
    logError({ fn: 'daily-backup-background', msg: err.message || 'Unknown error', durationMs: elapsed() });
    await writeStatus({ state: 'error', error: err.message || 'Unknown error', date: dateLabel });
  } finally {
    await mongo.close().catch(() => {});
    // Release the idempotency lock so a subsequent manual retry is allowed
    if (lockId && MONGODB_URI) {
      const lockDb = new MongoClient(MONGODB_URI);
      try {
        await lockDb.connect();
        await releaseJobLock(lockDb.db('dg_crm'), lockId);
      } catch { /* non-fatal */ } finally {
        await lockDb.close().catch(() => {});
      }
    }
  }
}
