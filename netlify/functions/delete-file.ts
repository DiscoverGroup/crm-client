/**
 * delete-file — Server-side file deletion from local MinIO storage
 *
 * Security model:
 *  - JWT authentication required
 *  - MinIO credentials stay server-side (never in the browser bundle)
 *  - Bucket whitelist prevents deleting from unintended buckets
 *  - Path traversal blocked
 *  - Rate limited: 20 deletes per minute per IP
 */

import type { Handler } from '@netlify/functions';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

// ── Server-side credentials (no VITE_ prefix — never sent to browser) ─────────
const MONGODB_URI        = process.env.MONGODB_URI          || '';
const DB_NAME            = 'dg_crm';
const STORAGE_ENDPOINT   = process.env.R2_ENDPOINT          || '';
const STORAGE_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID     || '';
const STORAGE_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';

const ALLOWED_BUCKETS = ['crm-uploads'];

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

  // ── 1. JWT authentication ──────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  let mongoClient: MongoClient | null = null;

  try {
    // ── 2. Parse and validate request body ──────────────────────────────────
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
    }

    const { filePath, bucket } = body as { filePath?: string; bucket?: string };

    if (!filePath || typeof filePath !== 'string' || filePath.trim() === '') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'filePath is required' }) };
    }

    // ── 3. Bucket whitelist ──────────────────────────────────────────────────
    const targetBucket = (typeof bucket === 'string' && bucket) ? bucket : 'crm-uploads';
    if (!ALLOWED_BUCKETS.includes(targetBucket)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid bucket' }) };
    }

    // ── 4. Path traversal guard ──────────────────────────────────────────────
    if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\0')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid file path' }) };
    }

    // ── 5. Rate limiting ─────────────────────────────────────────────────────
    if (MONGODB_URI) {
      try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);
        const clientIP = getClientIP(event.headers);
        const rateResult = await checkRateLimit(db, clientIP, 'delete-file', 20, 60);
        if (rateResult.limited) {
          return tooManyRequestsResponse(headers, 60);
        }
      } catch {
        // Non-fatal
      } finally {
        if (mongoClient) {
          await mongoClient.close();
          mongoClient = null;
        }
      }
    }

    if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY || !STORAGE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Storage not configured. Run scripts/setup-local-storage.ps1 first.' }),
      };
    }

    // ── 6. Delete from MinIO ─────────────────────────────────────────────────
    const s3 = buildStorageClient();
    await s3.send(new DeleteObjectCommand({ Bucket: targetBucket, Key: filePath }));

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: message }) };
  }
};
