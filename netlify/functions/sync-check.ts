/**
 * Lightweight sync-check endpoint.
 * Returns the latest modification timestamp for each synced collection.
 * Designed to be polled every few seconds — reads a single small document.
 */
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';
const COLLECTION = 'sync_metadata';

export const handler = async (event: any) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache, no-store',
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

  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const doc = await db.collection(COLLECTION).findOne({ _id: 'timestamps' as any });
    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamps: doc || {}
      })
    };
  } catch (err: any) {
    // Soft-fail: sync-check is polled every few seconds; returning 500 floods
    // the console and triggers infra alerts. Treat connectivity issues as
    // "no new sync data" so clients simply keep using their last seen state.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        timestamps: {},
        degraded: true,
        reason: err?.code || err?.name || 'connection-error'
      })
    };
  }
};
