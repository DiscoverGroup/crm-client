import type { Handler } from '@netlify/functions';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = 'dg_crm';

export const handler: Handler = async (event) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

    // Get all messages involving this user
    const messages = await messagesCol
      .find({
        $or: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      })
      .sort({ timestamp: -1 })
      .toArray();

    // Get groups where user is a participant
    const userGroups = await groupsCol
      .find({ participants: userId })
      .toArray();

    const groupIds = userGroups.map(g => g.id);

    // Get group messages
    const groupMessages = await messagesCol
      .find({ groupId: { $in: groupIds } })
      .sort({ timestamp: -1 })
      .toArray();

    // Combine all messages and sort by timestamp descending (newest first)
    const allMessages = [...messages, ...groupMessages].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Descending order
    });

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
    const groupMap = new Map(userGroups.map(g => [g.id, g]));

    for (const msg of allMessages) {
      let conversationKey;
      let otherUserId;
      let isGroup = false;

      if (msg.groupId) {
        conversationKey = `group_${msg.groupId}`;
        isGroup = true;
      } else {
        otherUserId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;
        // Normalize conversation key to ensure consistent grouping
        conversationKey = `user_${otherUserId}`;
        
        // Debug: Log to check for duplicate conversations
        if (conversationsMap.has(conversationKey)) {
          console.log(`Updating existing conversation: ${conversationKey}`);
        } else {
          console.log(`Creating new conversation: ${conversationKey}, fromUser: ${msg.fromUserId}, toUser: ${msg.toUserId}, currentUser: ${userId}`);
        }
      }

      if (!conversationsMap.has(conversationKey)) {
        const meta = metaMap.get(conversationKey) || { isPinned: false, isArchived: false };
        
        // Get the other user's name from the message
        let otherUserName = null;
        if (!isGroup) {
          if (msg.fromUserId === userId) {
            // Current user sent this message, get recipient's name
            otherUserName = msg.toUserName || null;
          } else {
            // Current user received this message, get sender's name
            otherUserName = msg.fromUserName || null;
          }
        }
        
        conversationsMap.set(conversationKey, {
          userId: otherUserId,
          groupId: msg.groupId,
          userName: otherUserName,
          groupName: isGroup ? (groupMap.get(msg.groupId)?.name || msg.groupId) : null,
          isGroup,
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          unreadCount: 0,
          isPinned: meta.isPinned,
          isArchived: meta.isArchived,
          participants: isGroup ? groupMap.get(msg.groupId)?.participants : undefined
        });
      } else {
        // Update unread count even if conversation exists
        const conv = conversationsMap.get(conversationKey);
        if (conv) {
          // Update lastMessage if this message is newer (shouldn't happen due to sort, but safety check)
          const existingTime = new Date(conv.lastMessageTime).getTime();
          const currentTime = new Date(msg.timestamp).getTime();
          if (currentTime > existingTime) {
            conv.lastMessage = msg.content;
            conv.lastMessageTime = msg.timestamp;
          }
        }
      }

      // Count unread messages
      if (msg.toUserId === userId && !msg.isRead) {
        const conv = conversationsMap.get(conversationKey);
        if (conv) conv.unreadCount++;
      }
      
      // Count unread group messages
      if (msg.groupId && msg.fromUserId !== userId && !msg.isRead) {
        const conv = conversationsMap.get(conversationKey);
        if (conv) conv.unreadCount++;
      }
    }

    // Get user names for conversations
    const userIds = Array.from(conversationsMap.values())
      .filter(conv => !conv.isGroup && conv.userId)
      .map(conv => conv.userId);

    if (userIds.length > 0) {
      const users = await usersCol
        .find({ 
          $or: [
            { id: { $in: userIds } },
            { email: { $in: userIds } }
          ]
        })
        .toArray();

      const userMap = new Map(users.map(u => [u.id || u.email, u.fullName || u.name || u.username]));

      for (const [key, conv] of conversationsMap.entries()) {
        if (!conv.isGroup && conv.userId) {
          const userName = userMap.get(conv.userId);
          conv.userName = userName || conv.userName || 'Unknown User';
        }
      }
    }

    await client.close();

    const conversations = Array.from(conversationsMap.values());

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: conversations })
    };
  } catch (error: any) {
    console.error('Get conversations error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to get conversations' 
      })
    };
  }
};
