/**
 * get-backup-status — Returns the live status.json for today's backup from R2.
 * Called by the AdminPanel while polling for backup completion.
 *
 * GET /.netlify/functions/get-backup-status
 * GET /.netlify/functions/get-backup-status?date=2026-04-28
 *
 * Returns:
 *   { found: true, status: { state, current, done, total, ... } }
 *   { found: false }   — status.json not written yet
 */

import type { Handler } from '@netlify/functions';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken } from './middleware/authMiddleware';
import { getCORSHeaders, getSecurityHeaders } from './utils/securityUtils';

const R2_ENDPOINT   = process.env.R2_ENDPOINT          || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID     || '';
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET     = process.env.R2_BUCKET_NAME       || 'crm-uploads';

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers, body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const auth = verifyAuthToken(event.headers['authorization']);
    if (!auth.valid) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'R2 not configured' }) };
    }

    const date = (event.queryStringParameters?.date) || new Date().toISOString().slice(0, 10);

    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    });

    try {
      const res = await s3.send(new GetObjectCommand({
        Bucket: R2_BUCKET,
        Key:    `backups/${date}/status.json`,
      }));

      const body = await res.Body?.transformToString();
      const status = body ? JSON.parse(body) : null;

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ found: true, status }),
      };
    } catch (e: any) {
      if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
        return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
      }
      throw e;
    }
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Failed to get backup status' }),
    };
  }
};
