import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

let cachedClient: MongoClient | null = null;

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 15000,
  maxIdleTimeMS: 120000, // Close idle connections after 2min — before AWS NAT drops them at ~4min
  tls: true,
  tlsAllowInvalidCertificates: false,
  retryWrites: false,
  retryReads: false,
  w: 'majority' as const,
  maxPoolSize: 1,
  minPoolSize: 0,
};

function isConnectionError(err: any): boolean {
  const msg: string = err?.message || '';
  return (
    msg.includes('timed out') ||
    msg.includes('topology') ||
    msg.includes('connection') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('ETIMEDOUT')
  );
}

async function createFreshClient(): Promise<MongoClient> {
  const client = new MongoClient(MONGODB_URI, MONGO_OPTIONS);
  await client.connect();
  cachedClient = client;
  return client;
}

async function getMongoClient(): Promise<MongoClient> {
  if (cachedClient) {
    // Quick ping to verify the cached connection is still alive
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch {
      // Stale connection — discard and reconnect
      try { await cachedClient.close(); } catch {}
      cachedClient = null;
    }
  }
  return createFreshClient();
}

export const handler: Handler = async (event) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Surrogate-Control': 'no-store',
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

  try {
    let mongoClient = await getMongoClient();
    let db = mongoClient.db(DB_NAME);
    let col = db.collection(collection);

    let result;
    let lastError: any;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
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
            return {
              statusCode: 400,
              headers,
              body: JSON.stringify({ error: 'Invalid operation' })
            };
        }
        // Success — exit retry loop
        break;
      } catch (opError: any) {
        lastError = opError;
        if (attempt === 0 && isConnectionError(opError)) {
          // Stale connection slipped through ping check — retry with fresh connection
          try { await cachedClient?.close(); } catch {}
          cachedClient = null;
          mongoClient = await createFreshClient();
          db = mongoClient.db(DB_NAME);
          col = db.collection(collection);
        } else {
          throw opError;
        }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (error: any) {
    // Clear cached client on connection errors so next request gets a fresh one
    if (isConnectionError(error)) {
      try { await cachedClient?.close(); } catch {}
      cachedClient = null;
    }
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
