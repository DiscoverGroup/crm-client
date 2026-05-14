/**
 * Track User Presence — POST /.netlify/functions/track-presence
 *
 * Called as a heartbeat by every active client every 60 seconds.
 * Stamps users.lastActiveAt for the authenticated user so that
 * get-active-users can count who is online.
 *
 * Rate limited to 5 calls per user per minute to tolerate tab focus/blur
 * spam while still rejecting floods.
 */

import type { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimitByUser, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── CSRF validation ────────────────────────────────────────────────────────
  const csrfToken = extractCSRFToken(event);
  const csrfResult = validateCSRFToken(csrfToken ?? '');
  if (!csrfResult.valid) {
    return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Invalid or missing CSRF token' }) };
  }

  // ── JWT Authentication ────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  const userId = auth.user!.userId;

  if (!MONGODB_URI) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: 'Database not configured' }) };
  }

  let client: MongoClient | null = null;
  try {
    client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
    const db = client.db(DB_NAME);

    // ── Per-user rate limit (20 req / user / 60 s — allows ~3 open tabs each beating every 60s) ──
    const ip = getClientIP(event.headers as Record<string, string>);
    const rl = await checkRateLimitByUser(db, userId, 'track-presence', 20, 60);
    if (rl.limited) return tooManyRequestsResponse(headers, 60);
    void ip; // ip captured for future IP-based limiting if needed

    // ── Stamp lastActiveAt ────────────────────────────────────────────────────
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lastActiveAt: new Date() } }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } finally {
    await client?.close();
  }
};
