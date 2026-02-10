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

    // Input validation to prevent NoSQL injection
    if (!message.fromUserId || typeof message.fromUserId !== 'string' || message.fromUserId.length > 100) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid fromUserId' })
      };
    }

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

    // Create message document
    const messageDoc = {
      id: message.id,
      fromUserId: message.fromUserId,
      fromUserName: message.fromUserName,
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
        error: error.message || 'Failed to send message' 
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
