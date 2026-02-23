import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

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

  // Allow GET requests
  if (event.httpMethod !== 'GET') {
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
    const { clientId } = event.queryStringParameters || {};

    if (!clientId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing clientId parameter' })
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
    const logNotesCollection = db.collection('log_notes');

    // Find all log notes for the client, sorted by timestamp (newest first)
    const logNotes = await logNotesCollection
      .find({ clientId })
      .sort({ timestamp: -1 })
      .toArray();

    // Convert MongoDB _id to string id
    const formattedNotes = logNotes.map((note: any) => ({
      id: note._id.toString(),
      clientId: note.clientId,
      userId: note.userId,
      userName: note.userName,
      timestamp: note.timestamp,
      type: note.type,
      action: note.action,
      description: note.description,
      status: note.status,
      fieldChanged: note.fieldChanged,
      oldValue: note.oldValue,
      newValue: note.newValue,
      replies: note.replies || []
    }));

    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        logNotes: formattedNotes
      })
    };
  } catch (error) {
    // console.error('Get log notes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve log notes' })
    };
  }
};
