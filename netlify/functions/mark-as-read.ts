import type { Handler } from '@netlify/functions';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimitByUser, tooManyRequestsResponse } from './utils/rateLimiter';
import { getMongoDb } from './utils/mongoClient';

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
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // ── CSRF validation ────────────────────────────────────────────────────────
  const csrfToken = extractCSRFToken(event);
  const csrfResult = validateCSRFToken(csrfToken ?? '');
  if (!csrfResult.valid) {
    return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Invalid or missing CSRF token' }) };
  }

  // ── JWT Authentication ─────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  if (!process.env.MONGODB_URI || process.env.MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  try {
    const { otherUserId, groupId } = JSON.parse(event.body || '{}');

    // Always use the authenticated user's ID from the JWT — never trust the body
    const userId = auth.user!.userId;

    const db = await getMongoDb();

    // ── Rate limit: 120 mark-as-read per user per 60s (one per conversation open) ──
    const rl = await checkRateLimitByUser(db, userId, 'mark-as-read', 120, 60);
    if (rl.limited) return tooManyRequestsResponse(headers, 60);

    const messagesCol = db.collection('messages');

    let query;

    if (groupId) {
      // Mark group messages as read (group messages don't have toUserId, only fromUserId)
      query = {
        groupId,
        fromUserId: { $ne: userId }, // Not sent by current user
        isRead: false
      };
    } else if (otherUserId) {
      // Mark direct messages as read
      query = {
        fromUserId: otherUserId,
        toUserId: userId,
        isRead: false
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Must specify either otherUserId or groupId' })
      };
    }

    const updateResult = await messagesCol.updateMany(
      query,
      { $set: { isRead: true } }
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        data: { modifiedCount: updateResult.modifiedCount } 
      })
    };
  } catch (error: any) {
    // console.error('Mark as read error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to mark messages as read' 
      })
    };
  }
};
