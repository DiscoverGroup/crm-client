/**
 * daily-backup — Scheduled Netlify function
 *
 * Runs every day at 2:00 AM UTC.
 * Exports all MongoDB collections to JSON and uploads to Cloudflare R2
 * under backups/YYYY-MM-DD/collection.json
 *
 * Schedule: "0 2 * * *" (cron — daily at 02:00 UTC)
 *
 * Required env vars (already set in Netlify):
 *   MONGODB_URI
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_ENDPOINT
 *   BACKUP_SECRET  ← add this: a random string to protect the manual trigger endpoint
 */

import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken } from './middleware/authMiddleware';

const MONGODB_URI   = process.env.MONGODB_URI   || '';
const DB_NAME       = 'dg_crm';
const R2_ENDPOINT   = process.env.R2_ENDPOINT   || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID      || '';
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY  || '';
// Bucket name matches the hardcoded value in get-upload-url.ts ('crm-uploads')
// Falls back to R2_BUCKET_NAME env var if set, otherwise uses 'crm-uploads'
const R2_BUCKET     = process.env.R2_BUCKET_NAME || 'crm-uploads';

// Collections to back up
const COLLECTIONS = ['clients', 'users', 'log_notes', 'activity_logs', 'file_attachments', 'calendar_events'];

export const handler: Handler = async (event) => {
  // Allow both scheduled invocations (no body) and manual HTTP trigger.
  // Manual trigger requires a valid admin JWT — same token used for all other functions.
  const isScheduled = !event.body;

  if (!isScheduled) {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method not allowed' };
    }
    // Validate JWT — admin must be logged in to trigger a manual backup
    const auth = verifyAuthToken(event.headers['authorization']);
    if (!auth.valid) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized — valid admin JWT required' }) };
    }
  }

  if (!MONGODB_URI) {
    return { statusCode: 500, body: JSON.stringify({ error: 'MONGODB_URI not configured' }) };
  }
  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY || !R2_BUCKET) {
    return { statusCode: 500, body: JSON.stringify({ error: 'R2 credentials not configured' }) };
  }

  const dateLabel = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });

  const mongo = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    tls: true,
    tlsAllowInvalidCertificates: false,
  });

  const results: Record<string, { count: number; path: string } | { error: string }> = {};

  try {
    await mongo.connect();
    const db = mongo.db(DB_NAME);

    for (const collectionName of COLLECTIONS) {
      try {
        const documents = await db.collection(collectionName).find({}).toArray();

        // Strip MongoDB internal _id from backup (restore uses our own id field)
        const cleanDocs = documents.map(({ _id, ...rest }) => rest);
        const payload   = JSON.stringify(cleanDocs, null, 2);
        const r2Key     = `backups/${dateLabel}/${collectionName}.json`;

        await s3.send(new PutObjectCommand({
          Bucket:      R2_BUCKET,
          Key:         r2Key,
          Body:        payload,
          ContentType: 'application/json',
        }));

        results[collectionName] = { count: cleanDocs.length, path: r2Key };
      } catch (collErr: any) {
        results[collectionName] = { error: collErr.message || 'Unknown error' };
      }
    }

    // Write a manifest file so you can verify backups at a glance
    const manifest = {
      timestamp:   new Date().toISOString(),
      date:        dateLabel,
      collections: results,
    };
    await s3.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         `backups/${dateLabel}/manifest.json`,
      Body:        JSON.stringify(manifest, null, 2),
      ContentType: 'application/json',
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, backup: manifest }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message || 'Backup failed' }),
    };
  } finally {
    await mongo.close();
  }
};
