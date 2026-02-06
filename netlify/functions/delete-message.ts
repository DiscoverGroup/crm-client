import type { Handler } from '@netlify/functions';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'crm_db';

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    console.error('Delete message error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to delete message',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    };
  } finally {
    if (client) {
      await client.close();
    }
  }
};
