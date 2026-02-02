import { MongoClient, Db } from 'mongodb';

// MongoDB connection string
// Note: This file is only used in Netlify Functions, not in the browser
const MONGODB_URI = typeof process !== 'undefined' ? (process.env.MONGODB_URI || 'mongodb://localhost:27017') : 'mongodb://localhost:27017';
const DB_NAME = 'dg_crm';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = await MongoClient.connect(MONGODB_URI);
  const db = client.db(DB_NAME);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

export async function getDatabase(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
