import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
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

    let query;

    if (groupId) {
      // Mark group messages as read
      query = {
        groupId,
        toUserId: userId,
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
      await client.close();
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Must specify either otherUserId or groupId' })
      };
    }

    const updateResult = await messagesCol.updateMany(
      query,
      { $set: { isRead: true } }
    );

    await client.close();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true, 
        data: { modifiedCount: updateResult.modifiedCount } 
      })
    };
  } catch (error: any) {
    console.error('Mark as read error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to mark messages as read' 
      })
    };
  }
};
