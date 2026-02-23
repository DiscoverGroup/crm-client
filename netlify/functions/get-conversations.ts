import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';
import { verifyAuthToken, unauthorizedResponse } from './middleware/authMiddleware';
import { getSecurityHeaders, getCORSHeaders } from './utils/securityUtils';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  // CORS headers + security headers
  const headers = {
    ...getCORSHeaders(process.env.ALLOWED_ORIGIN),
    ...getSecurityHeaders(),
    'Content-Type': 'application/json',
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
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
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'MONGODB_URI environment variable is not configured' 
      })
    };
  }

  try {
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: userId' })
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
    const messagesCol = db.collection('messages');
    const usersCol = db.collection('users');
    const conversationMetaCol = db.collection('conversation_meta');
    const groupsCol = db.collection('groups');

    // ── 1. Fetch user's groups ────────────────────────────────────────────────
    const userGroups = await groupsCol
      .find({ participants: userId })
      .toArray();
    const groupIds = userGroups.map((g: any) => g.id).filter(Boolean);
    const groupMap = new Map(userGroups.map((g: any) => [g.id, g]));

    // ── 2. Aggregate direct-message conversations (server-side) ───────────────
    // Instead of fetching 500 raw messages and grouping in Node.js, we let MongoDB
    // group by conversation partner and return only the summary (last message +
    // unread count) per conversation. This reduces data transfer by ~99 % on a
    // busy instance and uses the { fromUserId, timestamp } / { toUserId, timestamp }
    // indexes added in create-indexes.ts.
    const directConvAgg = await messagesCol.aggregate([
      {
        $match: {
          groupId: null,
          $or: [{ fromUserId: userId }, { toUserId: userId }],
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $addFields: {
          // Who is the other person in this conversation?
          conversationPartner: {
            $cond: [{ $eq: ['$fromUserId', userId] }, '$toUserId', '$fromUserId'],
          },
          partnerName: {
            $cond: [{ $eq: ['$fromUserId', userId] }, '$toUserName', '$fromUserName'],
          },
          // Normalised key: lexicographic ordering so A→B and B→A share the same key
          conversationKey: {
            $cond: [
              { $lt: ['$fromUserId', '$toUserId'] },
              { $concat: ['user_', '$fromUserId', '_', '$toUserId'] },
              { $concat: ['user_', '$toUserId', '_', '$fromUserId'] },
            ],
          },
        },
      },
      {
        $group: {
          _id:             '$conversationPartner',
          conversationKey: { $first: '$conversationKey' },
          lastMessage:     { $first: '$content' },
          lastMessageTime: { $first: '$timestamp' },
          otherUserName:   { $first: '$partnerName' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$toUserId', userId] }, { $eq: ['$isRead', false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { lastMessageTime: -1 } },
      { $limit: 100 },
    ]).toArray();

    // ── 3. Aggregate group conversations (server-side) ────────────────────────
    let groupConvAgg: any[] = [];
    if (groupIds.length > 0) {
      groupConvAgg = await messagesCol.aggregate([
        { $match: { groupId: { $in: groupIds } } },
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id:             '$groupId',
            conversationKey: { $first: { $concat: ['group_', '$groupId'] } },
            lastMessage:     { $first: '$content' },
            lastMessageTime: { $first: '$timestamp' },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ['$fromUserId', userId] }, { $eq: ['$isRead', false] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $sort: { lastMessageTime: -1 } },
      ]).toArray();
    }

    // ── 4. Fetch conversation metadata (pinned / archived) ────────────────────
    const conversationMetas = await conversationMetaCol
      .find({ userId })
      .toArray();
    const metaMap = new Map<string, { isPinned: boolean; isArchived: boolean }>(
      conversationMetas.map((meta: any) => [
        meta.conversationKey,
        { isPinned: Boolean(meta.isPinned), isArchived: Boolean(meta.isArchived) },
      ])
    );

    // ── 5. Resolve any still-unknown display names (one batched lookup) ───────
    const unresolvedIds = directConvAgg
      .filter((dc: any) => !dc.otherUserName && dc._id)
      .map((dc: any) => dc._id as string);
    const userNameMap = new Map<string, string>();
    if (unresolvedIds.length > 0) {
      const users = await usersCol
        .find({ $or: [{ id: { $in: unresolvedIds } }, { email: { $in: unresolvedIds } }] })
        .project({ _id: 0, id: 1, email: 1, fullName: 1, username: 1 })
        .toArray();
      for (const u of users) {
        const key = (u as any).id || (u as any).email;
        if (key) userNameMap.set(key, (u as any).fullName || (u as any).username || 'Unknown User');
      }
    }

    // ── 6. Build final conversation list ──────────────────────────────────────
    const conversations: any[] = [];

    for (const dc of directConvAgg) {
      const conversationKey = dc.conversationKey || `user_${dc._id}`;
      const meta = metaMap.get(conversationKey) || { isPinned: false, isArchived: false };
      conversations.push({
        userId:          dc._id,
        groupId:         null,
        userName:        dc.otherUserName || userNameMap.get(dc._id as string) || String(dc._id) || 'Unknown User',
        groupName:       null,
        isGroup:         false,
        lastMessage:     dc.lastMessage,
        lastMessageTime: dc.lastMessageTime,
        unreadCount:     dc.unreadCount,
        isPinned:        meta.isPinned,
        isArchived:      meta.isArchived,
      });
    }

    for (const gc of groupConvAgg) {
      const conversationKey = `group_${gc._id}`;
      const groupData = groupMap.get(gc._id as string);
      const meta = metaMap.get(conversationKey) || { isPinned: false, isArchived: false };
      conversations.push({
        userId:          null,
        groupId:         gc._id,
        userName:        null,
        groupName:       groupData?.name || String(gc._id) || 'Group',
        isGroup:         true,
        lastMessage:     gc.lastMessage,
        lastMessageTime: gc.lastMessageTime,
        unreadCount:     gc.unreadCount,
        isPinned:        meta.isPinned,
        isArchived:      meta.isArchived,
        participants:    groupData?.participants,
      });
    }

    // Pinned conversations float to the top; remainder sorted by latest message time
    conversations.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const tA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const tB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return tB - tA;
    });

    client.close().catch(() => {});

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: conversations }),
    };
  } catch (error: any) {
    // console.error('Get conversations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: 'Failed to get conversations' 
      })
    };
  }
};
