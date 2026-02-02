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
    const { collection, operation, data, filter, update, upsert } = JSON.parse(event.body || '{}');

    const client = await MongoClient.connect(MONGODB_URI);
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
    console.error('Database error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Database operation failed' 
      })
    };
  }
};
