/**
 * get-upload-url — Server-side presigned upload URL generator
 *
 * Security model:
 *  - JWT authentication required (no anonymous uploads)
 *  - MinIO credentials stay server-side (never in the browser bundle)
 *  - File type validated before issuing the URL
 *  - Bucket whitelist prevents traversal to other buckets
 *  - Path traversal blocked
 *  - Rate limited: 30 uploads per minute per IP
 *
 * Flow:
 *  1. Browser POSTs { fileName, contentType, folder, bucket } with JWT
 *  2. This function validates and returns { presignedUrl, path, url }
 *  3. Browser PUTs the file directly to MinIO via the presigned URL
 *     (file bytes never pass through this function — no 6 MB payload limit)
 */

import type { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { validateFileUpload } from './middleware/fileUploadSecurity';

// ── Server-side credentials (no VITE_ prefix — never sent to browser) ─────────
const MONGODB_URI        = process.env.MONGODB_URI        || '';
const DB_NAME            = 'dg_crm';
const STORAGE_ENDPOINT   = process.env.R2_ENDPOINT        || '';
const STORAGE_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID   || '';
const STORAGE_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const STORAGE_PUBLIC_URL = process.env.R2_PUBLIC_URL      || '';

// ── Whitelist — add bucket names here if you create more ─────────────────────
const ALLOWED_BUCKETS = ['crm-uploads'];

// ── Presigned URL TTL (seconds) ───────────────────────────────────────────────
const PRESIGNED_TTL = 300; // 5 minutes

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

    const { fileName, contentType, folder, bucket } = body as {
      fileName?: string;
      contentType?: string;
      folder?: string;
      bucket?: string;
    };

    if (!fileName || typeof fileName !== 'string' || fileName.trim() === '') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'fileName is required' }) };
    }
    if (!contentType || typeof contentType !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'contentType is required' }) };
    }
    if (fileName.length > 255) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'File name too long' }) };
    }

    // ── 3. Bucket whitelist check ────────────────────────────────────────────
    const targetBucket = (typeof bucket === 'string' && bucket) ? bucket : 'crm-uploads';
    if (!ALLOWED_BUCKETS.includes(targetBucket)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid bucket' }) };
    }

    // ── 4. Path traversal guard ──────────────────────────────────────────────
    const safeFolder = typeof folder === 'string' ? folder : '';
    if (safeFolder && (safeFolder.includes('..') || safeFolder.startsWith('/'))) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid folder path' }) };
    }

    // ── 5. File name / type validation ───────────────────────────────────────
    const fileValidation = validateFileUpload({ name: fileName, size: 1 });
    if (!fileValidation.valid) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: fileValidation.error }) };
    }

    // ── 6. Rate limiting (best-effort — skipped if MongoDB unavailable) ──────
    if (MONGODB_URI) {
      try {
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);
        const clientIP = getClientIP(event.headers);
        const rateResult = await checkRateLimit(db, clientIP, 'get-upload-url', 30, 60);
        if (rateResult.limited) {
          return tooManyRequestsResponse(headers, 60);
        }
      } catch {
        // Non-fatal: don't block the upload if the rate-limit DB is unavailable
      } finally {
        if (mongoClient) {
          await mongoClient.close();
          mongoClient = null;
        }
      }
    }

    // ── 7. Build a safe file path ────────────────────────────────────────────
    const timestamp   = Date.now();
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._\-()[\] ]/g, '_');
    const filePath    = safeFolder
      ? `${safeFolder}/${timestamp}-${safeFileName}`
      : `${timestamp}-${safeFileName}`;

    // ── 8. Generate presigned PUT URL (valid for PRESIGNED_TTL seconds) ──────
    if (!STORAGE_ENDPOINT || !STORAGE_ACCESS_KEY || !STORAGE_SECRET_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Storage not configured. Run setup-local-storage.ps1 first.' }),
      };
    }

    const s3 = buildStorageClient();
    const command = new PutObjectCommand({
      Bucket: targetBucket,
      Key: filePath,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGNED_TTL });

    // ── 9. Build public download URL ─────────────────────────────────────────
    const publicBase = STORAGE_PUBLIC_URL.endsWith('/')
      ? STORAGE_PUBLIC_URL.slice(0, -1)
      : STORAGE_PUBLIC_URL;
    const publicUrl = `${publicBase}/${filePath}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, presignedUrl, path: filePath, url: publicUrl }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: message }) };
  }
};
