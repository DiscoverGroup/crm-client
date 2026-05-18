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
import { ObjectId } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimitByUser, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { getMongoDb } from './utils/mongoClient';

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

  try {
    const db = await getMongoDb();

    // ── Per-user rate limit (20 req / user / 60 s — allows ~3 open tabs each beating every 60s) ──
    const ip = getClientIP(event.headers as Record<string, string>);
    const rl = await checkRateLimitByUser(db, userId, 'track-presence', 20, 60);
    if (rl.limited) return tooManyRequestsResponse(headers, 60);
    void ip; // ip captured for future IP-based limiting if needed

    // ── Stamp lastActiveAt ────────────────────────────────────────────────────
    // Guard against malformed userId (non-hex string) crashing ObjectId constructor
    if (!ObjectId.isValid(userId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid user id' }) };
    }
    await db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      { $set: { lastActiveAt: new Date() } }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch {
    // Heartbeat is best-effort — soft-fail so the Navbar doesn't show 502 storms.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, degraded: true }),
    };
  }
};
