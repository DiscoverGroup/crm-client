import type { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
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

  let client: MongoClient | null = null;

  try {
    const { messageId } = JSON.parse(event.body || '{}');

    if (!messageId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'messageId is required' }),
      };
    }

    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DB_NAME);

    // ── Rate limiting ─────────────────────────────────────────────────────────
    const ip = getClientIP(event.headers);
    const rl = await checkRateLimit(db, ip, 'delete-message', 20, 900);
    if (rl.limited) return tooManyRequestsResponse(headers, 900);

    const messagesCol = db.collection('messages');

    // Soft delete: mark message as deleted
    const result = await messagesCol.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          isDeleted: true,
          content: '[Message deleted]',
          deletedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Message not found' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Message deleted successfully'
      }),
    };
  } catch (error) {
    // console.error('Delete message error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to delete message',
      }),
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};
