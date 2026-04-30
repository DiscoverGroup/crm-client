import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

/** Exchange service account key for a short-lived access token via JWT Bearer flow. */
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

  // Import RSA private key and sign
  const pemBody = keyJson.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
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

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get Drive token: ${err}`);
  }

  const data = await tokenRes.json();
  return data.access_token as string;
}

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Find or create a folder by name under a given parent. Returns folder ID. */
async function ensureFolder(name: string, parentId: string | null, token: string): Promise<string> {
  const safeParent = parentId ?? 'root';
  const q = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${safeParent}' in parents and trashed=false`;
  const searchRes = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!searchRes.ok) throw new Error(`Drive search failed: ${await searchRes.text()}`);
  const { files } = await searchRes.json();
  if (files && files.length > 0) return files[0].id as string;

  // Create it
  const createRes = await fetch(`${DRIVE_API}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });

  if (!createRes.ok) throw new Error(`Drive create folder failed: ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id as string;
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
    return { statusCode: 503, headers, body: JSON.stringify({ success: false, error: 'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY env vars.' }) };
  }

  const keyJson: ServiceAccountKey = {
    client_email: clientEmail,
    private_key: privateKey.replace(/\\n/g, '\n'),
  };

  const { clientName, routeName } = JSON.parse(event.body || '{}');

  try {
    const accessToken = await getServiceAccountToken(keyJson);

    // Use the pre-shared folder ID if provided, otherwise create/find from root
    const sharedFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    const rootFolderId = sharedFolderId || await ensureFolder('CRM-Backups', null, accessToken);

    // Ensure route subfolder (always): root/{routeName}/  — defaults to "General" if no route given
    let parentFolderId = rootFolderId;
    const effectiveRoute = (routeName as string | undefined)?.trim() || 'General';
    const safeRoute = effectiveRoute.replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 100);
    parentFolderId = await ensureFolder(safeRoute, rootFolderId, accessToken);

    // Ensure per-client subfolder: root/{routeName?}/{clientName}/
    let folderId = parentFolderId;
    if (clientName) {
      const safeName = (clientName as string).replace(/[<>:"/\\|?*]/g, '-').trim().slice(0, 100);
      folderId = await ensureFolder(safeName, parentFolderId, accessToken);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        accessToken,
        folderId,
        uploadApi: UPLOAD_API,
      }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Failed to get Drive token' }),
    };
  }
};
