import { MongoClient, ObjectId } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders, sanitizeInput } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

// Recursively find a reply by ID and push a child reply into it
function addNestedReply(replies: any[], parentReplyId: string, newReply: any): boolean {
  for (const reply of replies) {
    if (reply.id === parentReplyId) {
      if (!reply.replies) reply.replies = [];
      reply.replies.push(newReply);
      return true;
    }
    if (reply.replies && reply.replies.length > 0) {
      if (addNestedReply(reply.replies, parentReplyId, newReply)) return true;
    }
  }
  return false;
}

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
    const { logNoteId, userId, userName, message, parentReplyId, attachments: rawAttachments } = JSON.parse(event.body || '{}');

    if (!logNoteId || !userId || !userName || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: logNoteId, userId, userName, message' })
      };
    }

    // Sanitise and validate attachments
    const attachments = Array.isArray(rawAttachments)
      ? rawAttachments.slice(0, 10).map((a: any) => ({
          id: sanitizeInput(String(a.id || '')).substring(0, 100),
          name: sanitizeInput(String(a.name || '')).substring(0, 200),
          type: sanitizeInput(String(a.type || '')).substring(0, 100),
          size: typeof a.size === 'number' ? a.size : 0,
          r2Path: sanitizeInput(String(a.r2Path || '')).substring(0, 500),
          url: sanitizeInput(String(a.url || '')).substring(0, 2000),
          uploadDate: sanitizeInput(String(a.uploadDate || '')).substring(0, 50),
        }))
      : [];

    const cleanMessage = sanitizeInput(String(message)).substring(0, 2000);
    const cleanUserName = sanitizeInput(String(userName)).substring(0, 100);
    const cleanUserId = sanitizeInput(String(userId)).substring(0, 100);

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

    const replyId = `reply_${new ObjectId().toString()}`;
    const newReply = {
      id: replyId,
      logNoteId: logNoteId,
      userId: cleanUserId,
      userName: cleanUserName,
      timestamp: new Date(),
      message: cleanMessage,
      attachments: attachments,
      replies: []
    };

    let result;

    if (!parentReplyId) {
      // Top-level reply: push directly to the log note's replies array
      result = await logNotesCollection.updateOne(
        { _id: new ObjectId(logNoteId) },
        { $push: { replies: newReply } as any }
      );
    } else {
      // Nested reply: load the doc, find the parent reply, insert, save back
      const doc = await logNotesCollection.findOne({ _id: new ObjectId(logNoteId) });
      if (!doc) {
        await client.close();
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Log note not found' }) };
      }

      const replies = doc.replies || [];
      const added = addNestedReply(replies, parentReplyId, newReply);
      if (!added) {
        await client.close();
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Parent reply not found' }) };
      }

      result = await logNotesCollection.updateOne(
        { _id: new ObjectId(logNoteId) },
        { $set: { replies } }
      );
    }

    await client.close();

    if (result.modifiedCount === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Log note not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, reply: newReply })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to add reply' })
    };
  }
};
