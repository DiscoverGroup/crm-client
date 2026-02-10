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
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const results = [];

    // Messages collection indexes for optimal query performance
    const messagesCol = db.collection('messages');
    await messagesCol.createIndex({ fromUserId: 1, toUserId: 1, timestamp: -1 });
    await messagesCol.createIndex({ toUserId: 1, isRead: 1 });
    await messagesCol.createIndex({ groupId: 1, timestamp: -1 });
    await messagesCol.createIndex({ timestamp: -1 });
    results.push('Messages indexes created');

    // Conversation metadata indexes
    const conversationMetaCol = db.collection('conversation_meta');
    await conversationMetaCol.createIndex({ userId: 1, otherUserId: 1 });
    await conversationMetaCol.createIndex({ userId: 1, groupId: 1 });
    results.push('Conversation metadata indexes created');

    // Users collection indexes
    const usersCol = db.collection('users');
    await usersCol.createIndex({ email: 1 }, { unique: true });
    await usersCol.createIndex({ username: 1 });
    results.push('Users indexes created');

    // Clients collection indexes
    const clientsCol = db.collection('clients');
    await clientsCol.createIndex({ id: 1 }, { unique: true });
    await clientsCol.createIndex({ clientNo: 1 });
    await clientsCol.createIndex({ email: 1 });
    await clientsCol.createIndex({ status: 1 });
    await clientsCol.createIndex({ isDeleted: 1 });
    results.push('Clients indexes created');

    // Groups collection indexes
    const groupsCol = db.collection('groups');
    await groupsCol.createIndex({ id: 1 }, { unique: true });
    await groupsCol.createIndex({ participants: 1 });
    results.push('Groups indexes created');

    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'All indexes created successfully',
        details: results
      })
    };
  } catch (error: any) {
    // console.error('Create indexes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to create indexes' 
      })
    };
  }
};
