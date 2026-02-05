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
    const { name, participantIds, participantNames, createdBy } = JSON.parse(event.body || '{}');

    if (!name || !participantIds || !participantIds.length || !createdBy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: name, participantIds, createdBy' })
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
    const groupsCol = db.collection('groups');

    const groupDoc = {
      id: Date.now().toString(),
      name,
      participants: participantIds,
      participantNames: participantNames || [],
      createdBy,
      createdAt: new Date()
    };

    await groupsCol.insertOne(groupDoc);
    await client.close();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: groupDoc })
    };
  } catch (error: any) {
    console.error('Create group error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to create group' 
      })
    };
  }
};
