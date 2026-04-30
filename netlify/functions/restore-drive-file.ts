/**
 * restore-drive-file
 *
 * Downloads a single file from Google Drive (via service account) and
 * re-uploads it to Cloudflare R2. Returns the R2 path and public URL so
 * the frontend can register it in FileService / MongoDB.
 *
 * Max file size: 25 MB (to stay within Netlify function memory limits).
 */
import type { Handler } from '@netlify/functions';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPES = ['https://www.googleapis.com/auth/drive'];
const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

async function getServiceAccountToken(keyJson: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: keyJson.client_email,
    scope: SCOPES.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const signingInput = `${encode(header)}.${encode(payload)}`;
  const pemBody = keyJson.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signingInput}.${sigB64}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) throw new Error(`Failed to get Drive token: ${await tokenRes.text()}`);
  const data = await tokenRes.json();
  return data.access_token as string;
}

function buildS3Client(): S3Client {
  return new S3Client({
    region: 'us-east-1',
    endpoint: process.env.R2_ENDPOINT || '',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
  });
}

/** Sanitize a filename: strip path separators and control chars. */
function sanitizeFilename(name: string): string {
  return name.replace(/[/\\<>:"|?*\x00-\x1f]/g, '_').slice(0, 200) || 'file';
}

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const r2PublicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  const r2Bucket = process.env.R2_BUCKET_NAME || 'crm-uploads';

  if (!clientEmail || !privateKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'Google Drive not configured.' }) };
  }
  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID) {
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'R2 storage not configured.' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { fileId, fileName, mimeType, clientId } = body as {
      fileId: string;
      fileName: string;
      mimeType: string;
      clientId?: string;
    };

    // Validate inputs
    if (!fileId || !/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid file ID.' }) };
    }
    if (!fileName) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'fileName is required.' }) };
    }

    const keyJson: ServiceAccountKey = {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    };
    const token = await getServiceAccountToken(keyJson);

    // ── Download from Drive ────────────────────────────────────────────────
    const downloadRes = await fetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!downloadRes.ok) {
      throw new Error(`Drive download failed (${downloadRes.status}): ${await downloadRes.text()}`);
    }

    const contentLength = parseInt(downloadRes.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_FILE_BYTES) {
      throw new Error(`File too large (${Math.round(contentLength / 1024 / 1024)} MB). Max 25 MB.`);
    }

    const fileBuffer = await downloadRes.arrayBuffer();
    if (fileBuffer.byteLength > MAX_FILE_BYTES) {
      throw new Error(`File too large (${Math.round(fileBuffer.byteLength / 1024 / 1024)} MB). Max 25 MB.`);
    }

    // ── Upload to R2 ───────────────────────────────────────────────────────
    const safeClientId = (clientId || 'unknown').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 100);
    const safeFileName = sanitizeFilename(fileName);
    const r2Path = `restored/${safeClientId}/${Date.now()}-${safeFileName}`;

    const s3 = buildS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: r2Bucket,
      Key: r2Path,
      Body: Buffer.from(fileBuffer),
      ContentType: mimeType || 'application/octet-stream',
    }));

    const publicUrl = `${r2PublicUrl}/${r2Path}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        r2Path,
        publicUrl,
        fileName: safeFileName,
        mimeType: mimeType || 'application/octet-stream',
        size: fileBuffer.byteLength,
      }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
