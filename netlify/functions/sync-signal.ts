/**
 * Lightweight endpoint to update the sync timestamp for a collection.
 * Called after any write operation to signal other devices.
 */
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const COLLECTION = 'sync_metadata';

const ALLOWED_KEYS = [
  'activity_logs',
  'file_attachments',
  'calendar_events',
  'notifications',
  'clients',
  'log_notes'
];

export const handler = async (event: any) => {
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

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  try {
    const { collection } = JSON.parse(event.body || '{}');

    if (!collection || !ALLOWED_KEYS.includes(collection)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid collection' })
      };
    }

    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });

    const db = client.db(DB_NAME);
    const now = new Date().toISOString();

    await db.collection(COLLECTION).updateOne(
      { _id: 'timestamps' as any },
      { $set: { [collection]: now, lastGlobal: now } },
      { upsert: true }
    );

    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, timestamp: now })
    };
  } catch {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Sync signal failed' })
    };
  }
};
