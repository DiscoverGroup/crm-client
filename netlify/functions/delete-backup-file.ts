/**
 * delete-backup-file — Deletes a single backup file from R2.
 * Admin only. Only keys inside the backups/ prefix are allowed.
 *
 * DELETE /.netlify/functions/delete-backup-file?key=backups/2026-04-28/clients.json
 * Requires: Authorization: Bearer <admin JWT>
 */

import type { Handler } from '@netlify/functions';
import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { verifyAuthToken } from './middleware/authMiddleware';
import { getCORSHeaders, getSecurityHeaders } from './utils/securityUtils';

const R2_ENDPOINT   = process.env.R2_ENDPOINT          || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID     || '';
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET     = process.env.R2_BUCKET_NAME       || 'crm-uploads';

export const handler: Handler = async (event) => {
  const jsonHeaders = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: jsonHeaders, body: '' };
    }
    if (event.httpMethod !== 'DELETE') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Admin-only — regular users must never be able to delete backups
    const auth = verifyAuthToken(event.headers['authorization']);
    if (!auth.valid) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }
    if (auth.user?.role !== 'admin') {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: 'Admin role required' }) };
    }

    const key = event.queryStringParameters?.key || '';

    // Only allow deleting files inside backups/ — prevent path traversal or accidental deletion of CRM uploads
    if (!key || !key.startsWith('backups/') || key.includes('..')) {
      return { statusCode: 400, headers: jsonHeaders, body: JSON.stringify({ error: 'Invalid backup key' }) };
    }

    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: 'R2 credentials not configured' }) };
    }

    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    });

    // Check if this is a request to delete an entire date folder (key ends with /)
    const isFolder = key.endsWith('/');

    if (isFolder) {
      // List all objects in this date prefix and delete them all
      const list = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: key }));
      const keys = (list.Contents || []).map(o => o.Key).filter(Boolean) as string[];
      await Promise.all(keys.map(k => s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: k }))));
      return {
        statusCode: 200,
        headers: jsonHeaders,
        body: JSON.stringify({ success: true, deleted: keys.length }),
      };
    }

    await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({ success: true, deleted: key }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: err.message || 'Delete failed' }),
    };
  }
};
