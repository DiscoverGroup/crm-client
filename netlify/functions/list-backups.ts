/**
 * list-backups — Returns a list of all backup files stored in Cloudflare R2
 * under the backups/ prefix, grouped by date.
 *
 * Requires a valid admin JWT in the Authorization header.
 */

import type { Handler } from '@netlify/functions';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const R2_ENDPOINT   = process.env.R2_ENDPOINT          || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY_ID     || '';
const R2_SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET     = process.env.R2_BUCKET_NAME       || 'crm-uploads';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL        || '';

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  if (!R2_ENDPOINT || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'R2 credentials not configured' }),
    };
  }

  try {
    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
    });

    // List all objects under backups/
    const command = new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: 'backups/',
      MaxKeys: 1000,
    });

    const response = await s3.send(command);
    const objects = response.Contents || [];

    // Group by date folder: backups/YYYY-MM-DD/file.json
    const byDate: Record<string, Array<{ name: string; size: number; lastModified: string; url: string }>> = {};

    for (const obj of objects) {
      const key = obj.Key || '';
      const parts = key.split('/'); // ['backups', 'YYYY-MM-DD', 'file.json']
      if (parts.length < 3 || !parts[2]) continue; // skip folder entries

      const date = parts[1];
      const fileName = parts[2];
      const publicUrl = R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}` : '';

      if (!byDate[date]) byDate[date] = [];
      byDate[date].push({
        name: fileName,
        size: obj.Size || 0,
        lastModified: obj.LastModified?.toISOString() || '',
        url: publicUrl,
      });
    }

    // Sort dates descending (newest first)
    const sorted = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, files]) => ({
        date,
        files: files.sort((a, b) => a.name.localeCompare(b.name)),
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
      }));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, backups: sorted }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Failed to list backups' }),
    };
  }
};
