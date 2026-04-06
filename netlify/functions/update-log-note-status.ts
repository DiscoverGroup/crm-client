import { MongoClient, ObjectId } from 'mongodb';
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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) {
    return unauthorizedResponse(headers, auth.error);
  }

  try {
    const { logNoteId, status, changedBy, changedAt } = JSON.parse(event.body || '{}');

    if (!logNoteId || !status) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing logNoteId or status' }) };
    }

    const allowedStatuses = ['pending', 'done', 'on hold'];
    if (!allowedStatuses.includes(status)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid status value' }) };
    }

    if (!ObjectId.isValid(logNoteId)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid logNoteId' }) };
    }

    const updateFields: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (status !== 'pending') {
      updateFields.statusChangedAt = changedAt ? new Date(changedAt) : new Date();
      // Prefer the name sent from the frontend; fall back to the name in the JWT
      const resolvedName = (typeof changedBy === 'string' && changedBy.trim())
        ? changedBy.trim().substring(0, 100)
        : (auth.user?.fullName || auth.user?.email || 'Unknown');
      updateFields.statusChangedBy = resolvedName;
    } else {
      // Clear status change info when reverting to pending
      updateFields.statusChangedAt = null;
      updateFields.statusChangedBy = null;
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
    const result = await db.collection('log_notes').updateOne(
      { _id: new ObjectId(logNoteId) },
      { $set: updateFields }
    );

    await client.close();

    if (result.matchedCount === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Log note not found' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, status }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to update status' }) };
  }
};
