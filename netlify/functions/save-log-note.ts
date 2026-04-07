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
    const { clientId, userId, userName, type, action, description, status, fieldChanged, oldValue, newValue, parentActivityLogId, attachments: rawAttachments } = JSON.parse(event.body || '{}');

    if (!clientId || !userId || !userName || !action || !description) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' })
      };
    }

    // Sanitise and validate attachments
    // Note: r2Path, url and type must NOT go through sanitizeInput which escapes
    // forward slashes (/ → &#x2F;), breaking file paths, URLs and MIME types.
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.slice(0, 10).map((a: any) => ({
          id: sanitizeInput(String(a.id || '')).substring(0, 100),
          name: sanitizeInput(String(a.name || '')).substring(0, 200),
          // MIME type: only alphanumeric, slash, plus, dot, hyphen
          type: String(a.type || '').toLowerCase().replace(/[^a-z0-9/+.\-]/g, '').substring(0, 100),
          size: typeof a.size === 'number' ? a.size : 0,
          // R2 path: only safe path characters (no HTML encoding)
          r2Path: String(a.r2Path || '').replace(/[^a-zA-Z0-9/_.()+\- ]/g, '').substring(0, 500),
          // URL: strip HTML tags only, preserve structure
          url: String(a.url || '').replace(/<[^>]*>/g, '').replace(/[\x00-\x1F\x7F]/g, '').substring(0, 2000),
          uploadDate: sanitizeInput(String(a.uploadDate || '')).substring(0, 50),
        }))
      : [];

    // Strip HTML tags and null/control chars but preserve printable chars (no HTML entity encoding)
    const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim();

    // Sanitise string inputs and enforce length caps
    const cleanDescription = stripTags(String(description)).substring(0, 5000);
    const cleanAction = stripTags(String(action)).substring(0, 200);
    const cleanUserName = sanitizeInput(String(userName)).substring(0, 100);
    const cleanClientId = String(clientId).replace(/[^a-zA-Z0-9_\-]/g, '').substring(0, 100);
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
      parentActivityLogId: parentActivityLogId || null,
      attachments: attachments,
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
      headers,
      body: JSON.stringify({ error: 'Failed to save log note' })
    };
  }
};
