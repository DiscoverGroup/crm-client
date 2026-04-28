/**
 * get-zip-status — Returns the live zip-status.json for today's ZIP creation from R2.
 * Called by the AdminPanel polling loop while waiting for create-r2-files-zip-background.
 *
 * GET /.netlify/functions/get-zip-status?date=2026-04-28
 *
 * Returns:
 *   { found: true, status: { state, done, total, phase, sizeBytes?, error? } }
 *   { found: false }
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

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return { statusCode: 403, headers, body: JSON.stringify({ error: 'Unauthorized' }) };

  const date = event.queryStringParameters?.date || new Date().toISOString().slice(0, 10);

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });

  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: `backups/${date}/zip-status.json`,
    }));

    const body = await res.Body!.transformToString();
    const status = JSON.parse(body);
    return { statusCode: 200, headers, body: JSON.stringify({ found: true, status }) };

  } catch (err: any) {
    if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
      return { statusCode: 200, headers, body: JSON.stringify({ found: false }) };
    }
    console.error('get-zip-status error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to read zip status' }) };
  }
};
