import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
    const { userId, otherUserId, groupId } = JSON.parse(event.body || '{}');

    // Input validation
    if (!userId || typeof userId !== 'string' || userId.length > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid userId' })
      };
    }

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

    // TODO: Implement pagination for better performance
    // For now, limit to 1000 messages. Future: use skip/limit with cursor-based pagination
    const limit = 1000;
    const messages = await messagesCol
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    // Reverse to show oldest first in UI
    messages.reverse();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: messages })
    };
  } catch (error: any) {
    console.error('Get messages error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to get messages' 
      })
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
  }
};
