import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse, forbiddenResponse, isAdmin } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import type { StorageMode } from '../../src/types/storage';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const VALID_MODES: StorageMode[] = ['cloudflare-r2', 'local-mac'];

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

  // ── Admin-only ─────────────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);
  if (!isAdmin(auth.user!)) return forbiddenResponse(headers, 'Admin access required');

  if (!MONGODB_URI) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'MONGODB_URI not configured' }) };
  }

  const body = JSON.parse(event.body || '{}');
  const { mode, localMac } = body;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!mode || !VALID_MODES.includes(mode)) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: `mode must be one of: ${VALID_MODES.join(', ')}` }) };
  }

  if (mode === 'local-mac') {
    if (!localMac?.ip || typeof localMac.ip !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'localMac.ip is required when mode is local-mac' }) };
    }
    const port = Number(localMac.port);
    if (!port || port < 1 || port > 65535) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'localMac.port must be a valid port number (1-65535)' }) };
    }
    if (!localMac.token || typeof localMac.token !== 'string' || localMac.token.length < 8) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'localMac.token must be at least 8 characters' }) };
    }
  }

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      maxPoolSize: 1,
    });
    await client.connect();

    await client.db(DB_NAME).collection('settings').updateOne(
      { key: 'storage_config' },
      {
        $set: {
          key: 'storage_config',
          mode,
          localMac: mode === 'local-mac'
            ? { ip: localMac.ip.trim(), port: Number(localMac.port), token: localMac.token }
            : { ip: '', port: 4040, token: '' },
          updatedAt: new Date(),
          updatedBy: auth.user!.userId,
        },
      },
      { upsert: true }
    );

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, mode }) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Failed to save storage config' }) };
  } finally {
    await client?.close().catch(() => {});
  }
};
