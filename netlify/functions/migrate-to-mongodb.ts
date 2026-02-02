import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { localStorageData } = JSON.parse(event.body || '{}');

    if (!localStorageData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No data provided' })
      };
    }

    const client = await MongoClient.connect(MONGODB_URI);
    const db = client.db(DB_NAME);

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

    await client.close();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Data migrated successfully to MongoDB' 
      })
    };
  } catch (error: any) {
    console.error('Migration error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Migration failed' 
      })
    };
  }
};
