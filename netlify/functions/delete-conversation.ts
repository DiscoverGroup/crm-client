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

  try {
    const { userId, otherUserId, groupId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required field: userId' })
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
    const conversationMetaCol = db.collection('conversation_meta');

    let query;
    let conversationKey;

    if (groupId) {
      query = { groupId };
      conversationKey = `group_${groupId}`;
    } else if (otherUserId) {
      query = {
        $or: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId }
        ]
      };
      conversationKey = `user_${otherUserId}`;
    } else {
      await client.close();
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Must specify either otherUserId or groupId' })
      };
    }

    // Delete all messages
    const deleteResult = await messagesCol.deleteMany(query);

    // Delete conversation metadata
    await conversationMetaCol.deleteOne({
      userId,
      conversationKey
    });

    await client.close();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        data: { deletedCount: deleteResult.deletedCount } 
      })
    };
  } catch (error: any) {
    // console.error('Delete conversation error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to delete conversation' 
      })
    };
  }
};
