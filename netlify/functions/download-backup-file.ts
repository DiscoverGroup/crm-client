/**
 * download-backup-file — Proxies a backup JSON file from R2 to the browser.
 *
 * The R2 bucket is private — backup files are NOT public.
 * This endpoint streams the file using server-side R2 credentials,
 * so the bucket never needs to be publicly accessible.
 *
 * GET /.netlify/functions/download-backup-file?key=backups/2026-04-28/clients.json
 * Requires: Authorization: Bearer <admin JWT>
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
  const jsonHeaders = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: jsonHeaders, body: '' };
    }
    if (event.httpMethod !== 'GET') {
      return { statusCode: 405, headers: jsonHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const auth = verifyAuthToken(event.headers['authorization']);
    if (!auth.valid) {
      return { statusCode: 403, headers: jsonHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const key = event.queryStringParameters?.key || '';

    // Only allow downloading files inside the backups/ prefix — prevent path traversal
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

    const obj = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));

    const bodyText = await obj.Body?.transformToString('utf-8') ?? '';
    const fileName = key.split('/').pop() || 'backup.json';

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
      body: bodyText,
    };
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return { statusCode: 404, headers: jsonHeaders, body: JSON.stringify({ error: 'Backup file not found' }) };
    }
    return { statusCode: 500, headers: jsonHeaders, body: JSON.stringify({ error: err.message || 'Download failed' }) };
  }
};
