import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import type { StorageSettings } from '../../src/types/storage';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

const DEFAULT: StorageSettings = {
  mode: 'cloudflare-r2',
  localMac: { ip: '', port: 4040, token: '' },
};

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);

  if (!MONGODB_URI) {
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: DEFAULT }) };
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
    const doc = await client.db(DB_NAME).collection('settings').findOne({ key: 'storage_config' });

    if (!doc) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: DEFAULT }) };
    }

    const data: StorageSettings = {
      mode: doc.mode ?? DEFAULT.mode,
      localMac: {
        ip: doc.localMac?.ip ?? '',
        port: doc.localMac?.port ?? 4040,
        // Never return the token to the client — it's a server secret
        token: '',
      },
    };

    // Admin callers get the token back so the UI can pre-fill it
    if (auth.user?.role === 'admin') {
      data.localMac.token = doc.localMac?.token ?? '';
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
  } catch (err: any) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Failed to load storage config' }) };
  } finally {
    await client?.close().catch(() => {});
  }
};
