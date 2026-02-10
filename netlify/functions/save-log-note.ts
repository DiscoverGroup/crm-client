import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler = async (event: any) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { clientId, userId, userName, type, action, description, status, fieldChanged, oldValue, newValue } = JSON.parse(event.body);

    if (!clientId || !userId || !userName || !action || !description) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();

    const db = client.db(DB_NAME);
    const logNotesCollection = db.collection('log_notes');

    const logNote = {
      _id: new ObjectId(),
      clientId,
      userId,
      userName,
      timestamp: new Date(),
      type: type || 'manual',
      action,
      description,
      status: status || 'pending',
      fieldChanged: fieldChanged || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
      replies: []
    };

    const result = await logNotesCollection.insertOne(logNote);

    await client.close();

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        logNote: {
          id: result.insertedId.toString(),
          ...logNote,
          _id: undefined
        }
      })
    };
  } catch (error) {
    console.error('Save log note error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to save log note' })
    };
  }
};
