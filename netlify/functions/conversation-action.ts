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
    const { userId, otherUserId, groupId, action, value } = JSON.parse(event.body || '{}');

    if (!userId || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: userId, action' })
      };
    }

    const conversationKey = groupId 
      ? `group_${groupId}` 
      : `user_${otherUserId}`;

    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const conversationMetaCol = db.collection('conversation_meta');

    let updateField: any = {};

    switch (action) {
      case 'togglePin':
        // Get current state and toggle it
        const currentPinDoc = await conversationMetaCol.findOne({ userId, conversationKey });
        updateField = { isPinned: !(currentPinDoc?.isPinned || false) };
        break;
      case 'toggleArchive':
        // Get current state and toggle it
        const currentArchiveDoc = await conversationMetaCol.findOne({ userId, conversationKey });
        updateField = { isArchived: !(currentArchiveDoc?.isArchived || false) };
        break;
      case 'isPinned':
      case 'isArchived':
        // Query operation
        const doc = await conversationMetaCol.findOne({
          userId,
          conversationKey
        });
        await client.close();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            success: true, 
            data: doc ? doc[action] : false 
          })
        };
      default:
        await client.close();
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

    // Update or create conversation metadata
    await conversationMetaCol.updateOne(
      { userId, conversationKey },
      { 
        $set: { 
          ...updateField,
          updatedAt: new Date()
        },
        $setOnInsert: {
          userId,
          conversationKey,
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    await client.close();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (error: any) {
    console.error('Conversation action error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to perform conversation action' 
      })
    };
  }
};
