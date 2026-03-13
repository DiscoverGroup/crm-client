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

  // Check if MongoDB URI is configured
  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured in Netlify' 
      })
    };
  }

  try {
    const { collection, operation, data, filter, update, upsert } = JSON.parse(event.body || '{}');

    // ── Collection allowlist — prevent access to sensitive internal collections ──
    const ALLOWED_COLLECTIONS = [
      'clients', 'messages', 'groups', 'conversation_meta',
      'log_notes', 'activity_logs', 'notifications', 'calendar_events',
      'file_attachments', 'file_recovery_requests', 'client_recovery_requests',
      'users'
    ];
    if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Access to this collection is not permitted' })
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
    const col = db.collection(collection);

    let result;

    switch (operation) {
      case 'find':
        result = await col.find(filter || {}).toArray();
        break;
      case 'findOne':
        result = await col.findOne(filter);
        break;
      case 'insertOne':
        result = await col.insertOne(data);
        break;
      case 'insertMany':
        result = await col.insertMany(data);
        break;
      case 'updateOne':
        result = await col.updateOne(filter, { $set: update }, { upsert: upsert || false });
        break;
      case 'updateMany':
        result = await col.updateMany(filter, { $set: update }, { upsert: upsert || false });
        break;
      case 'deleteOne':
        result = await col.deleteOne(filter);
        break;
      case 'deleteMany':
        result = await col.deleteMany(filter);
        break;
      default:
        await client.close();
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid operation' })
        };
    }

    await client.close();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (error: any) {
    // console.error('Database error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Database operation failed'
      })
    };
  }
};
