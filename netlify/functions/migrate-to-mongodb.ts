import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse, forbiddenResponse, isAdmin } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
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
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // ── Admin-only JWT Authentication ─────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);
  if (!isAdmin(auth.user!)) return forbiddenResponse(headers, 'Admin access required');

  // Declare outside try so the finally block can always close the connection.
  let dbClient: MongoClient | undefined;

  try {
    const { localStorageData } = JSON.parse(event.body || '{}');

    if (!localStorageData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No data provided' })
      };
    }

    dbClient = await MongoClient.connect(MONGODB_URI);
    const db = dbClient.db(DB_NAME);

    // Migrate users
    if (localStorageData.crm_users) {
      const users = JSON.parse(localStorageData.crm_users);
      if (users.length > 0) {
        await db.collection('users').deleteMany({});
        await db.collection('users').insertMany(users);
      }
    }

    // Migrate clients
    if (localStorageData.crm_clients) {
      const clients = JSON.parse(localStorageData.crm_clients);
      if (clients.length > 0) {
        await db.collection('clients').deleteMany({});
        await db.collection('clients').insertMany(clients);
      }
    }

    // Migrate activity logs
    if (localStorageData.crm_activity_logs) {
      const logs = JSON.parse(localStorageData.crm_activity_logs);
      if (logs.length > 0) {
        await db.collection('activity_logs').deleteMany({});
        await db.collection('activity_logs').insertMany(logs);
      }
    }

    // Migrate file attachments
    if (localStorageData.crm_file_attachments) {
      const files = JSON.parse(localStorageData.crm_file_attachments);
      if (files.length > 0) {
        await db.collection('file_attachments').deleteMany({});
        await db.collection('file_attachments').insertMany(files);
      }
    }

    // Migrate payments
    if (localStorageData.crm_payments) {
      const payments = JSON.parse(localStorageData.crm_payments);
      if (payments.length > 0) {
        await db.collection('payments').deleteMany({});
        await db.collection('payments').insertMany(payments);
      }
    }

    // Migrate log notes
    if (localStorageData.crm_log_notes) {
      const notes = JSON.parse(localStorageData.crm_log_notes);
      if (notes.length > 0) {
        await db.collection('log_notes').deleteMany({});
        await db.collection('log_notes').insertMany(notes);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Data migrated successfully to MongoDB' 
      })
    };
  } catch (error: any) {
    // console.error('Migration error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Migration failed' 
      })
    };
  } finally {
    // dbClient is now always in scope — connection is closed on both success and error paths.
    try { await dbClient?.close(); } catch { /* already closed or never opened */ }
  }
};
