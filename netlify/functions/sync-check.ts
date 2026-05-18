/**
 * Lightweight sync-check endpoint.
 * Returns the latest modification timestamp for each synced collection.
 * Designed to be polled every few seconds — reads a single small document.
 */
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { getMongoDb } from './utils/mongoClient';

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
    const db = await getMongoDb();
    const doc = await db.collection(COLLECTION).findOne({ _id: 'timestamps' as any });

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
