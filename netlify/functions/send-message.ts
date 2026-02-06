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

  try {
    const message = JSON.parse(event.body || '{}');

    // Validate required fields
    if (!message.fromUserId || !message.content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: fromUserId, content' })
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

    const client = await MongoClient.connect(MONGODB_URI, {
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
    
    // Close connection with timeout
    try {
      await Promise.race([
        client.close(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Close timeout')), 5000))
      ]);
    } catch (closeError) {
      console.error('Error closing MongoDB connection:', closeError);
      // Force close if graceful close failed
      try {
        await client.close(true);
      } catch (e) {
        console.error('Force close failed:', e);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: messageDoc })
    };
  } catch (error: any) {
    console.error('Send message error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to send message' 
      })
    };
  }
};
