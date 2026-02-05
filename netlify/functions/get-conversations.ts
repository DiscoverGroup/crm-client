import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
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
    const { userId } = JSON.parse(event.body || '{}');

    if (!userId) {
      return {
        statusCode: 400,
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

    // Get all messages involving this user
    const messages = await messagesCol
      .find({
        $or: [
          { fromUserId: userId },
          { toUserId: userId },
          { groupId: { $exists: true } }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get conversation metadata (pinned, archived status)
    const conversationMetas = await conversationMetaCol
      .find({ userId })
      .toArray();

    const metaMap = new Map(
      conversationMetas.map(meta => [
        meta.conversationKey, 
        { isPinned: meta.isPinned, isArchived: meta.isArchived }
      ])
    );

    // Group messages by conversation
    const conversationsMap = new Map();

    for (const msg of messages) {
      let conversationKey;
      let otherUserId;
      let isGroup = false;

      if (msg.groupId) {
        conversationKey = `group_${msg.groupId}`;
        isGroup = true;
      } else {
        otherUserId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
        conversationKey = `user_${otherUserId}`;
      }

      if (!conversationsMap.has(conversationKey)) {
        const meta = metaMap.get(conversationKey) || { isPinned: false, isArchived: false };
        
        conversationsMap.set(conversationKey, {
          userId: otherUserId,
          groupId: msg.groupId,
          userName: isGroup ? null : (msg.fromUserId === userId ? null : msg.fromUserName),
          groupName: isGroup ? msg.groupId : null,
          isGroup,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          unreadCount: 0,
          isPinned: meta.isPinned,
          isArchived: meta.isArchived
        });
      }

      // Count unread messages
      if (msg.toUserId === userId && !msg.isRead) {
        const conv = conversationsMap.get(conversationKey);
        conv.unreadCount++;
      }
    }

    // Get user names for conversations
    const userIds = Array.from(conversationsMap.values())
      .filter(conv => !conv.isGroup && conv.userId)
      .map(conv => conv.userId);

    if (userIds.length > 0) {
      const users = await usersCol
        .find({ id: { $in: userIds } })
        .toArray();

      const userMap = new Map(users.map(u => [u.id, u.name]));

      for (const [key, conv] of conversationsMap.entries()) {
        if (!conv.isGroup && conv.userId) {
          conv.userName = userMap.get(conv.userId) || 'Unknown User';
        }
      }
    }

    await client.close();

    const conversations = Array.from(conversationsMap.values());

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, data: conversations })
    };
  } catch (error: any) {
    console.error('Get conversations error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to get conversations' 
      })
    };
  }
};
