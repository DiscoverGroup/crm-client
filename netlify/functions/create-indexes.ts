import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse, forbiddenResponse, isAdmin } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';
import { validateCSRFToken, extractCSRFToken } from './utils/csrfProtection';
import { checkRateLimit, tooManyRequestsResponse, getClientIP } from './utils/rateLimiter';

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

  // ── CSRF validation ────────────────────────────────────────────────────────
  const csrfToken = extractCSRFToken(event);
  const csrfResult = validateCSRFToken(csrfToken ?? '');
  if (!csrfResult.valid) {
    return { statusCode: 403, headers, body: JSON.stringify({ success: false, error: 'Invalid or missing CSRF token' }) };
  }
  // ── Admin-only JWT Authentication ─────────────────────────────────────────
  const auth = verifyAuthToken(event.headers['authorization']);
  if (!auth.valid) return unauthorizedResponse(headers, auth.error);
  if (!isAdmin(auth.user!)) return forbiddenResponse(headers, 'Admin access required');

  if (!MONGODB_URI || MONGODB_URI === 'mongodb://localhost:27017') {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls: true,
      tlsAllowInvalidCertificates: false,
      retryWrites: true,
      w: 'majority',
    });

    const db = client.db(DB_NAME);

    // ── Rate limiting ─────────────────────────────────────────────────────────
    const ip = getClientIP(event.headers as Record<string, string>);
    const rl = await checkRateLimit(db, ip, 'create-indexes', 5, 900);
    if (rl.limited) return tooManyRequestsResponse(headers, 900);

    const results = [];

    // ── Messages collection ───────────────────────────────────────────────────
    const messagesCol = db.collection('messages');
    // Compound index used by the send/get-messages direct-chat queries
    await messagesCol.createIndex({ fromUserId: 1, toUserId: 1, timestamp: -1 });
    // Individual direction indexes let MongoDB satisfy $or queries with index scans
    await messagesCol.createIndex({ fromUserId: 1, timestamp: -1 });
    await messagesCol.createIndex({ toUserId: 1, timestamp: -1 });
    // Used by mark-as-read: filter unread messages by recipient
    await messagesCol.createIndex({ toUserId: 1, isRead: 1, timestamp: -1 });
    // Group message queries (get-conversations aggregation + get-messages)
    await messagesCol.createIndex({ groupId: 1, timestamp: -1 });
    await messagesCol.createIndex({ groupId: 1, isRead: 1 });
    // Global recency sort (fallback full-collection sort)
    await messagesCol.createIndex({ timestamp: -1 });
    // Partial TTL index: documents with an explicit `expireAt` field are auto-deleted.
    // Set msg.expireAt = new Date(...) when archiving a message to a cold store.
    await messagesCol.createIndex(
      { expireAt: 1 },
      { expireAfterSeconds: 0, sparse: true }
    );
    results.push('Messages indexes created');

    // ── Conversation metadata ─────────────────────────────────────────────────
    const conversationMetaCol = db.collection('conversation_meta');
    await conversationMetaCol.createIndex({ userId: 1, otherUserId: 1 });
    await conversationMetaCol.createIndex({ userId: 1, groupId: 1 });
    // Fast lookup used by get-conversations to resolve pinned/archived state
    await conversationMetaCol.createIndex({ userId: 1, conversationKey: 1 });
    results.push('Conversation metadata indexes created');

    // ── Users collection ──────────────────────────────────────────────────────
    const usersCol = db.collection('users');
    await usersCol.createIndex({ email: 1 }, { unique: true });
    await usersCol.createIndex({ username: 1 }, { unique: true, sparse: true });
    // Admin panel filters by verification/approval status
    await usersCol.createIndex({ isVerified: 1 });
    await usersCol.createIndex({ role: 1 });
    await usersCol.createIndex({ approvalStatus: 1, role: 1 });
    // Presence: get-active-users filters by lastActiveAt — sparse so users who
    // have never sent a heartbeat don't consume index space.
    await usersCol.createIndex({ lastActiveAt: 1 }, { sparse: true });
    results.push('Users indexes created');

    // ── Clients collection ────────────────────────────────────────────────────
    const clientsCol = db.collection('clients');
    await clientsCol.createIndex({ id: 1 }, { unique: true });
    await clientsCol.createIndex({ clientNo: 1 });
    await clientsCol.createIndex({ email: 1 });
    // Individual status/deleted indexes
    await clientsCol.createIndex({ status: 1 });
    await clientsCol.createIndex({ isDeleted: 1 });
    // Two-field compound (filter by deleted + status)
    await clientsCol.createIndex({ isDeleted: 1, status: 1 });
    await clientsCol.createIndex({ isDeleted: 1, createdAt: -1 });
    // Three-field compound: covers the most common list query
    // (active clients filtered by status, sorted by newest first)
    await clientsCol.createIndex({ isDeleted: 1, status: 1, createdAt: -1 });
    // Text search on client name and email — enables efficient $regex/$text on names
    await clientsCol.createIndex({ isDeleted: 1, clientNo: 1 });
    results.push('Clients indexes created');

    // ── Groups collection ─────────────────────────────────────────────────────
    const groupsCol = db.collection('groups');
    await groupsCol.createIndex({ id: 1 }, { unique: true });
    await groupsCol.createIndex({ participants: 1 });
    results.push('Groups indexes created');

    // ── Log notes collection ──────────────────────────────────────────────────
    // Previously had NO indexes — every get-log-notes call was a full collection scan.
    const logNotesCol = db.collection('log_notes');
    // Primary access pattern: fetch all notes for a client, newest first
    await logNotesCol.createIndex({ clientId: 1, timestamp: -1 });
    // Secondary: user-based queries (who added notes)
    await logNotesCol.createIndex({ userId: 1, timestamp: -1 });
    // Compound: client + user filter (admin audit view)
    await logNotesCol.createIndex({ clientId: 1, userId: 1, timestamp: -1 });
    results.push('Log notes indexes created');

    // ── Settings collection ───────────────────────────────────────────────────
    const settingsCol = db.collection('settings');
    await settingsCol.createIndex({ key: 1 }, { unique: true });
    results.push('Settings indexes created');

    // ── Rate-limits collection ────────────────────────────────────────────────
    // The old TTL index was on `createdAt` with a varying expireAfterSeconds value.
    // Because MongoDB only honours the TTL configured when the index was first created,
    // all rate-limit documents created with a shorter window never expired, causing
    // counters to grow forever and eventually blocking all users permanently.
    // Fix: drop the old index (if present) and create a fixed `expiresAt` TTL index
    // (expireAfterSeconds: 0) so each document controls its own expiry.
    const rateLimitsCol = db.collection('rate_limits');
    try {
      await rateLimitsCol.dropIndex('createdAt_1');
      results.push('Dropped old rate_limits createdAt_1 TTL index');
    } catch {
      // Index may not exist — fine
      results.push('rate_limits createdAt_1 index not found (already removed or never existed)');
    }
    await rateLimitsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true });
    // Clear any stale counters so no user is left in a permanently-limited state
    await rateLimitsCol.deleteMany({});
    results.push('rate_limits expiresAt TTL index created, stale counters cleared');


    await client.close();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        message: 'All indexes created successfully',
        details: results
      })
    };
  } catch (error: any) {
    // console.error('Create indexes error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
error: 'Failed to create indexes'
      })
    };
  }
};
