import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

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

  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  let client: MongoClient | null = null;

  try {
    const message = JSON.parse(event.body || '{}');

    // ── Force fromUserId from JWT — prevents spoofing ──────────────────────────
    // Ignore any fromUserId supplied in the body; always use the verified JWT identity.
    message.fromUserId = auth.user!.userId;

    if (!message.content || typeof message.content !== 'string' || message.content.length > 10000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid content - must be 1-10000 characters' })
      };
    }

    if (message.toUserId && (typeof message.toUserId !== 'string' || message.toUserId.length > 100)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid toUserId' })
      };
    }

    if (message.groupId && (typeof message.groupId !== 'string' || message.groupId.length > 100)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid groupId' })
      };
    }

    // Must have either toUserId or groupId, but not both
    if (!message.toUserId && !message.groupId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Must specify either toUserId or groupId' })
      };
    }
    
    if (message.toUserId && message.groupId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Cannot specify both toUserId and groupId' })
      };
    }

    const db = await getMongoDb();

    // ── Rate limiting: 60 messages per IP per minute ───────────────────────────
    const ip = getClientIP(event.headers as Record<string, string>);
    const rateLimit = await checkRateLimit(db, ip, 'send-message', 60, 60);
    if (rateLimit.limited) {
      return tooManyRequestsResponse(headers, 60);
    }

    const messagesCol = db.collection('messages');

    // Create message document
    const messageDoc = {
      id: message.id,
      fromUserId: auth.user!.userId,  // always from JWT, never from body
      fromUserName: auth.user!.fullName || message.fromUserName, // prefer JWT-derived name
      toUserId: message.toUserId || null,
      toUserName: message.toUserName || null,
      groupId: message.groupId || null,
      content: message.content,
      timestamp: message.timestamp || new Date().toISOString(),
      isRead: message.isRead || false,
      replyTo: message.replyTo || null,
      createdAt: new Date()
    };

    // Insert message
    await messagesCol.insertOne(messageDoc);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: messageDoc })
    };
  } catch (error: any) {
    // console.error('Send message error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to send message' 
      })
    };
  }
};
