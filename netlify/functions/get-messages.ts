import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

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

  // ── JWT Authentication ─────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  let client: MongoClient | null = null;

  try {
    const { otherUserId, groupId, before, limit: rawLimit } = JSON.parse(event.body || '{}');

    // Always derive userId from the verified JWT — never trust the request body
    const userId = auth.user!.userId;

    // Input validation
    if (otherUserId && (typeof otherUserId !== 'string' || otherUserId.length > 100)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid otherUserId' })
      };
    }

    if (groupId && (typeof groupId !== 'string' || groupId.length > 100)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid groupId' })
      };
    }

    client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const messagesCol = db.collection('messages');

    let query;
    if (groupId) {
      // Get group messages
      query = { groupId };
    } else if (otherUserId) {
      // Get direct messages between two users
      query = {
        $or: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId }
        ]
      };
    } else {
      // Get all messages for user
      query = {
        $or: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      };
    }

    // ── Cursor-based pagination ───────────────────────────────────────────────
    // Pass `before` (ISO timestamp string, exclusive upper bound) to load messages
    // older than that point. Pass `limit` (1–100, default 50).
    // Response includes `hasMore` and `nextBefore` so the client can page backwards.
    const pageLimit = Math.min(Math.max(1, parseInt(String(rawLimit ?? '50'), 10) || 50), 100);
    if (before && typeof before === 'string') {
      (query as any).timestamp = { $lt: before };
    }

    // Fetch one extra document to detect whether an older page exists
    const messages = await messagesCol
      .find(query)
      .sort({ timestamp: -1 })
      .limit(pageLimit + 1)
      .toArray();

    const hasMore = messages.length > pageLimit;
    if (hasMore) messages.pop(); // Remove the extra sentinel document
    messages.reverse(); // Oldest-first for the UI

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: messages,
        hasMore,
        // Pass this value as `before` on the next request to load the previous page
        nextBefore: hasMore && messages.length > 0 ? messages[0].timestamp : null,
      }),
    };
  } catch (error: any) {
    // console.error('Get messages error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to get messages' 
      })
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (e) {
        // console.error('Error closing connection:', e);
      }
    }
  }
};
