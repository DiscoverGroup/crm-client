/**
 * Get Active Users — GET /.netlify/functions/get-active-users
 *
 * Returns the count (and optional list) of users who sent a heartbeat
 * within the last 2 minutes.  Polled by the Navbar every 30 seconds.
 *
 * Response: { success: true, count: number, users: Array<{ fullName: string }> }
 */

import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { getMongoDb } from './utils/mongoClient';

// Users are considered "active" if they pinged within this window
const ACTIVE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── JWT Authentication ────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  try {
    const db = await getMongoDb();

    // ── Rate limit (60 req / IP / 60 s — one poll every ~30 s is well within this) ──
    const ip = getClientIP(event.headers as Record<string, string>);
    const rl = await checkRateLimit(db, ip, 'get-active-users', 60, 60);
    if (rl.limited) return tooManyRequestsResponse(headers, 60);

    const since = new Date(Date.now() - ACTIVE_WINDOW_MS);

    const activeUsers = await db
      .collection('users')
      .find(
        { lastActiveAt: { $gte: since }, approvalStatus: 'approved' },
        { projection: { fullName: 1, email: 1, department: 1, position: 1, profileImageR2Path: 1, _id: 0 } }
      )
      .toArray();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: activeUsers.length,
        users: activeUsers,
      }),
    };
  } catch {
    // Soft-fail: this endpoint is polled every 30s by the Navbar.
    // Returning 502 floods the console; return an empty active list instead.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: 0, users: [], degraded: true }),
    };
  }
};
