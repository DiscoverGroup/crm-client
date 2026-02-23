import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders, sanitizeInput } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler = async (event: any) => {
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
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

  try {
    const { clientId, userId, userName, type, action, description, status, fieldChanged, oldValue, newValue } = JSON.parse(event.body || '{}');

    if (!clientId || !userId || !userName || !action || !description) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Sanitise string inputs and enforce length caps
    const cleanDescription = sanitizeInput(String(description)).substring(0, 5000);
    const cleanAction = sanitizeInput(String(action)).substring(0, 200);
    const cleanUserName = sanitizeInput(String(userName)).substring(0, 100);
    const cleanClientId = sanitizeInput(String(clientId)).substring(0, 100);
    const cleanUserId = sanitizeInput(String(userId)).substring(0, 100);
    const cleanStatus = ['pending', 'done', 'on hold'].includes(status) ? status : 'pending';

    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const logNotesCollection = db.collection('log_notes');

    const logNote = {
      _id: new ObjectId(),
      clientId: cleanClientId,
      userId: cleanUserId,
      userName: cleanUserName,
      timestamp: new Date(),
      type: type || 'manual',
      action: cleanAction,
      description: cleanDescription,
      status: cleanStatus,
      fieldChanged: fieldChanged || null,
      oldValue: oldValue || null,
      newValue: newValue || null,
      replies: []
    };

    const result = await logNotesCollection.insertOne(logNote);

    await client.close();

    return {
      statusCode: 201,
      headers,
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
    // console.error('Save log note error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to save log note' })
    };
  }
};
