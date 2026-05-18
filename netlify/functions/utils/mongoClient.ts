/**
 * Shared MongoDB client with connection pooling.
 *
 * Netlify Functions run on AWS Lambda, which reuses warm containers for
 * subsequent invocations. Opening a fresh MongoDB connection on every
 * request adds 1–2 s of latency and is the main cause of intermittent
 * 500 / 502 errors on polled endpoints (sync-check, get-active-users,
 * track-presence, get-conversations, get-messages).
 *
 * This module caches a single MongoClient at module scope and reuses it
 * across invocations within the same warm container. A lightweight `ping`
 * verifies the cached connection is still alive before reuse; stale
 * connections (e.g. dropped by AWS NAT after ~4 min of idle) are
 * transparently replaced.
 *
 * Usage:
 *   import { getMongoDb } from './utils/mongoClient';
 *   const db = await getMongoDb();
 *   await db.collection('users').findOne(...);
 *   // Do NOT call client.close() — the connection is intentionally cached.
 */

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

const MONGO_OPTIONS = {
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 15000,
  maxIdleTimeMS: 120000, // Close idle connections after 2 min — before AWS NAT drops them at ~4 min
  tls: true,
  tlsAllowInvalidCertificates: false,
  retryWrites: true,
  w: 'majority' as const,
  maxPoolSize: 1,
  minPoolSize: 0,
};

let cachedClient: MongoClient | null = null;
let connectingPromise: Promise<MongoClient> | null = null;

async function createFreshClient(): Promise<MongoClient> {
  const client = new MongoClient(MONGODB_URI, MONGO_OPTIONS);
  await client.connect();
  cachedClient = client;
  return client;
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    throw new Error('MONGODB_URI environment variable is not configured');
  }

  if (cachedClient) {
    try {
      await cachedClient.db('admin').command({ ping: 1 });
      return cachedClient;
    } catch {
      try { await cachedClient.close(); } catch {}
      cachedClient = null;
    }
  }

  // De-duplicate concurrent cold-start connection attempts
  if (connectingPromise) return connectingPromise;
  connectingPromise = createFreshClient().finally(() => {
    connectingPromise = null;
  });
  return connectingPromise;
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(DB_NAME);
}
