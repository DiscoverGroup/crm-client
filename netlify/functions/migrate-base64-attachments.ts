/**
 * migrate-base64-attachments — Server-side base64 → R2 migration
 *
 * Scans MongoDB's `file_attachments` collection for documents whose
 * `file.data` field still contains a `data:` URL (legacy base64 fallback)
 * and migrates them to Cloudflare R2.
 *
 * Two modes:
 *   - mode: 'scan'    → Returns total count + small sample of pending entries
 *   - mode: 'migrate' → Processes up to `batchSize` documents:
 *                       reads base64 → uploads to R2 → updates MongoDB doc
 *                       (clears `file.data` base64, sets `file.data` to public URL,
 *                        sets `file.r2Path`, `file.isR2 = true`).
 *
 * Designed to fit in Netlify's ~10 s function timeout: default batch = 3.
 * Caller (admin UI) loops until `remaining === 0`.
 *
 * Security: admin-only (JWT role === 'admin'). Rate-limited.
 */

import type { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';
import {
  verifyAuthToken,
  unauthorizedResponse,
  forbiddenResponse,
  isAdmin,
} from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI         = process.env.MONGODB_URI          || '';
const DB_NAME             = 'dg_crm';
const COLLECTION          = 'file_attachments';
const STORAGE_ENDPOINT    = process.env.R2_ENDPOINT          || '';
const STORAGE_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID     || '';
const STORAGE_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY || '';
const STORAGE_PUBLIC_URL  = process.env.R2_PUBLIC_URL        || '';
const BUCKET              = process.env.R2_BUCKET_NAME        || 'crm-uploads';

const DEFAULT_BATCH_SIZE  = 3;
const MAX_BATCH_SIZE      = 10;
// Hard ceiling on a single base64 payload we'll attempt to migrate.
// Anything larger than this is skipped to avoid memory/timeout issues.
const MAX_FILE_BYTES      = 25 * 1024 * 1024; // 25 MB

function buildStorageClient(): S3Client {
  return new S3Client({
    region: 'us-east-1',
    endpoint: STORAGE_ENDPOINT,
    credentials: {
      accessKeyId: STORAGE_ACCESS_KEY,
      secretAccessKey: STORAGE_SECRET_KEY,
    },
    forcePathStyle: true,
  });
}

/** Same folder logic as the browser FileService (kept in sync manually). */
function getFolderByCategory(category: string, source?: string): string {
  const folders: Record<string, string> = {
    'deposit-slip': 'deposit-slips',
    'receipt': 'receipts',
    'other': 'other-files',
  };
  let folder = folders[category] || 'general';
  if (source) folder = `${folder}/${source}`;
  return folder;
}

/** Decode a `data:<mime>;base64,<payload>` URL into { mime, bytes }. */
function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/i.exec(dataUrl);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const payload = match[2] || '';
  if (dataUrl.includes(';base64,')) {
    return { mime, bytes: Buffer.from(payload, 'base64') };
  }
  // Non-base64 (URL-encoded) data URL — extremely rare for binary files but supported.
  return { mime, bytes: Buffer.from(decodeURIComponent(payload), 'utf-8') };
}

function sanitizeFileName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._\-()[\] ]/g, '_').slice(0, 240);
}

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Auth: admin only ──────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid || !auth.user) {
    return unauthorizedResponse(headers, auth.error);
  }
  if (!isAdmin(auth.user)) {
    return forbiddenResponse(headers, 'Admin access required');
  }

  if (!MONGODB_URI) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'MongoDB not configured' }) };
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(event.body || '{}'); } catch { /* allow empty */ }

  const mode = (body.mode === 'migrate' ? 'migrate' : 'scan') as 'scan' | 'migrate';
  const batchSize = Math.min(
    MAX_BATCH_SIZE,
    Math.max(1, typeof body.batchSize === 'number' ? body.batchSize : DEFAULT_BATCH_SIZE)
  );

  let mongoClient: MongoClient | null = null;

  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);

    // Rate limit (best-effort)
    try {
      const clientIP = getClientIP(event.headers);
      const rl = await checkRateLimit(db, clientIP, 'migrate-base64-attachments', 30, 60);
      if (rl.limited) return tooManyRequestsResponse(headers, 60);
    } catch { /* non-fatal */ }

    const coll = db.collection(COLLECTION);

    // Match: not yet on R2 AND data field starts with "data:"
    const baseFilter = {
      $and: [
        { 'file.isR2': { $ne: true } },
        { 'file.data': { $regex: '^data:', $options: 'i' } },
      ],
    };

    // ── SCAN ────────────────────────────────────────────────────────────────
    if (mode === 'scan') {
      const totalCount = await coll.countDocuments(baseFilter);
      const samples = await coll
        .find(baseFilter, {
          projection: {
            _id: 0,
            'file.id': 1,
            'file.name': 1,
            'file.size': 1,
            'file.type': 1,
            clientId: 1,
            category: 1,
          },
        })
        .limit(20)
        .toArray();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, mode: 'scan', totalCount, samples }),
      };
    }

    // ── MIGRATE BATCH ───────────────────────────────────────────────────────
    if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY || !STORAGE_SECRET_KEY || !STORAGE_PUBLIC_URL) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ success: false, error: 'R2 storage not configured server-side' }),
      };
    }

    const s3 = buildStorageClient();
    const publicBase = STORAGE_PUBLIC_URL.endsWith('/')
      ? STORAGE_PUBLIC_URL.slice(0, -1)
      : STORAGE_PUBLIC_URL;

    const docs = await coll.find(baseFilter).limit(batchSize).toArray();
    const totalBefore = await coll.countDocuments(baseFilter);

    const results: Array<{
      id: string;
      name: string;
      status: 'migrated' | 'failed' | 'skipped';
      error?: string;
      url?: string;
    }> = [];

    for (const doc of docs) {
      const fileObj = (doc as any).file || {};
      const fileId = fileObj.id || String((doc as any)._id);
      const name = fileObj.name || `file-${fileId}`;

      try {
        const dataUrl = String(fileObj.data || '');
        if (!dataUrl.startsWith('data:')) {
          results.push({ id: fileId, name, status: 'skipped', error: 'No data: URL' });
          // Mark as skipped by clearing data so we don't re-scan it
          await coll.updateOne(
            { _id: (doc as any)._id },
            { $set: { 'file.data': '', 'file.migrationSkipped': true, 'file.migrationSkippedAt': new Date().toISOString() } }
          );
          continue;
        }

        const decoded = decodeDataUrl(dataUrl);
        if (!decoded) {
          throw new Error('Could not decode data URL');
        }
        if (decoded.bytes.length > MAX_FILE_BYTES) {
          throw new Error(`File too large for server-side migration (${decoded.bytes.length} bytes; max ${MAX_FILE_BYTES})`);
        }

        const folder = getFolderByCategory((doc as any).category || 'other', (doc as any).source);
        const safeName = sanitizeFileName(name);
        const r2Path = `${folder}/${Date.now()}-${safeName}`;

        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: r2Path,
          Body: decoded.bytes,
          ContentType: fileObj.type || decoded.mime,
        }));

        const publicUrl = `${publicBase}/${r2Path}`;

        await coll.updateOne(
          { _id: (doc as any)._id },
          {
            $set: {
              'file.data': publicUrl,
              'file.r2Path': r2Path,
              'file.isR2': true,
              'file.storagePlatform': 'r2',
              'file.migratedAt': new Date().toISOString(),
              'file.migratedBy': auth.user!.userId,
            },
          }
        );

        results.push({ id: fileId, name, status: 'migrated', url: publicUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Mark failure on the doc so we don't endlessly retry the same broken record
        try {
          await coll.updateOne(
            { _id: (doc as any)._id },
            {
              $set: {
                'file.migrationLastError': msg,
                'file.migrationLastErrorAt': new Date().toISOString(),
              },
              $inc: { 'file.migrationAttempts': 1 },
            }
          );
        } catch { /* non-fatal */ }
        results.push({ id: fileId, name, status: 'failed', error: msg });
      }
    }

    const remaining = await coll.countDocuments(baseFilter);
    const migrated = results.filter(r => r.status === 'migrated').length;
    const failed = results.filter(r => r.status === 'failed').length;
    const skipped = results.filter(r => r.status === 'skipped').length;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        mode: 'migrate',
        processed: docs.length,
        migrated,
        failed,
        skipped,
        totalBefore,
        remaining,
        results,
      }),
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: msg }) };
  } finally {
    if (mongoClient) await mongoClient.close().catch(() => undefined);
  }
};
