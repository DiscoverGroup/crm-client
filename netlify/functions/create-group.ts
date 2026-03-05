import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders, sanitizeInput } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
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

  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  try {
    const { name, participantIds, participantNames } = JSON.parse(event.body || '{}');

    // Use the authenticated user's identity from the JWT — never trust the body
    const createdBy = auth.user!.userId;

    if (!name || !participantIds || !participantIds.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: name, participantIds, createdBy' })
      };
    }

    // Sanitise and validate
    const cleanName = sanitizeInput(String(name)).substring(0, 80);
    // createdBy comes from JWT — already trusted, no sanitization required
    if (!cleanName) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Group name is required' }) };
    }
    if (!Array.isArray(participantIds) || participantIds.length === 0 || participantIds.length > 50) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'participantIds must be an array of 1–50 members' }) };
    }
    const cleanParticipantIds: string[] = participantIds
      .filter((id: unknown) => typeof id === 'string')
      .map((id: string) => sanitizeInput(id).substring(0, 100));
    const cleanParticipantNames: string[] = Array.isArray(participantNames)
      ? participantNames
          .filter((n: unknown) => typeof n === 'string')
          .map((n: string) => sanitizeInput(n).substring(0, 100))
      : [];

    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);
    const groupsCol = db.collection('groups');

    const groupDoc = {
      id: Date.now().toString(),
      name: cleanName,
      participants: cleanParticipantIds,
      participantNames: cleanParticipantNames,
      createdBy: createdBy,
      createdAt: new Date()
    };

    await groupsCol.insertOne(groupDoc);
    await client.close();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: groupDoc })
    };
  } catch (error: any) {
    // console.error('Create group error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to create group' 
      })
    };
  }
};
