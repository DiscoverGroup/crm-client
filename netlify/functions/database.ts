import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { checkRateLimit, checkRateLimitByUser, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';
import { logInfo, logWarn, logError, startTimer } from './utils/logger';

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

  const ip = getClientIP(event.headers as Record<string, string>);
  const elapsed = startTimer();

  // ── JWT Authentication ─────────────────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    logWarn({ fn: 'database', msg: 'Unauthorized request', ip });
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

  const { collection, operation, data, filter, update, upsert, sort, limit, projection } = JSON.parse(event.body || '{}');

  // ── Rate limiting: 300 requests per IP per minute ─────────────────────────
  // Prevents runaway clients or compromised tokens from hammering Atlas.
  // Runs inside the try-block below to reuse the same connection.

  // ── Collection allowlist — prevent access to sensitive internal collections ──
  const ALLOWED_COLLECTIONS = [
    'clients', 'messages', 'groups', 'conversation_meta',
    'log_notes', 'activity_logs', 'notifications', 'calendar_events',
    'file_attachments', 'file_recovery_requests', 'client_recovery_requests',
    'users', 'settings'
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

    // ── Rate limiting ──────────────────────────────────────────────────────────
    // Primary: per-user limit (120 req / user / 60 s ≈ 2 req/s per employee).
    // Multiple employees sharing the same office NAT IP each get their own budget.
    const userRateLimit = await checkRateLimitByUser(db, auth.user!.userId, 'database', 120, 60);
    if (userRateLimit.limited) {
      logWarn({ fn: 'database', msg: 'Per-user rate limit exceeded', ip, userId: auth.user?.userId });
      return tooManyRequestsResponse(headers, 60);
    }
    // Secondary: per-IP burst guard — 600 req / IP / 60 s catches abuse/scrapers
    // but does NOT block legitimate office traffic from multiple employees.
    const ipRateLimit = await checkRateLimit(db, ip, 'database', 600, 60);
    if (ipRateLimit.limited) {
      logWarn({ fn: 'database', msg: 'Per-IP rate limit exceeded', ip, userId: auth.user?.userId });
      return tooManyRequestsResponse(headers, 60);
    }

    let col = db.collection(collection);

    let result;
    let lastError: any;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        switch (operation) {
          case 'find': {
            // Optional modifiers for scalable queries:
            //   sort       — e.g. { createdAt: -1 }
            //   limit      — integer 1–1000 (capped to 1000 to prevent accidental full dumps)
            //   projection — e.g. { name: 1, email: 1, _id: 0 }
            const safeLimit = limit != null ? Math.min(Math.max(1, parseInt(String(limit), 10) || 1000), 1000) : undefined;
            let cursor = col.find(filter || {});
            if (sort) cursor = cursor.sort(sort);
            if (safeLimit !== undefined) cursor = cursor.limit(safeLimit);
            if (projection) cursor = cursor.project(projection);
            result = await cursor.toArray();
            break;
          }
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
          logWarn({ fn: 'database', msg: 'Stale connection — retrying', op: `${operation}:${collection}`, userId: auth.user?.userId, ip });
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

    const durationMs = elapsed();
    logInfo({ fn: 'database', msg: 'OK', op: `${operation}:${collection}`, userId: auth.user?.userId, ip, durationMs, statusCode: 200 });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: result })
    };
  } catch (error: any) {
    const durationMs = elapsed();
    // Clear cached client on connection errors so next request gets a fresh one
    if (isConnectionError(error)) {
      try { await cachedClient?.close(); } catch {}
      cachedClient = null;
    }
    logError({ fn: 'database', msg: error?.message || 'Unknown error', op: `${operation}:${collection}`, userId: auth.user?.userId, ip, durationMs, statusCode: 500 });
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
