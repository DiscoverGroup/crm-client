import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SCOPES = ['https://www.googleapis.com/auth/drive'];

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
  if (!clientEmail || !privateKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'Google Drive not configured.' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const folderId: string | undefined = body.folderId;

    // Validate folderId if provided (Drive IDs are alphanumeric + _ -)
    if (folderId && !/^[a-zA-Z0-9_\-]+$/.test(folderId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid folder ID.' }) };
    }

    const rootId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
    const targetId = folderId || rootId;
    if (!targetId) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'No folder ID provided and GOOGLE_DRIVE_FOLDER_ID not set.' }) };
    }

    const keyJson: ServiceAccountKey = {
      client_email: clientEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    };
    const token = await getServiceAccountToken(keyJson);

    const q = `'${targetId}' in parents and trashed=false`;
    const fields = 'files(id,name,mimeType,size,modifiedTime)';
    const listRes = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(fields)}&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) throw new Error(`Drive list failed: ${await listRes.text()}`);
    const { files } = await listRes.json();

    const folders: { id: string; name: string }[] = [];
    const fileList: { id: string; name: string; size: number; mimeType: string; modifiedTime: string }[] = [];

    for (const f of (files || [])) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({ id: f.id, name: f.name });
      } else {
        fileList.push({
          id: f.id,
          name: f.name,
          size: f.size ? parseInt(f.size, 10) : 0,
          mimeType: f.mimeType || 'application/octet-stream',
          modifiedTime: f.modifiedTime || '',
        });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, folders, files: fileList }),
    };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message }) };
  }
};
