export interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId?: string; // Optional for group messages
  toUserName?: string; // Optional for group messages
  groupId?: string; // For group messages
  message: string;
  timestamp: Date;
  isRead: boolean;
  seenAt?: Date; // When the message was seen
  reactions?: { [userId: string]: string }; // userId -> emoji
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
}

export interface Conversation {
  userId?: string;
  userName?: string;
  groupId?: string;
  groupName?: string;
  participants?: string[]; // Array of user IDs for group chats
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
  isGroup?: boolean;
  isArchived?: boolean; // Whether conversation is archived
}

export interface GroupChat {
  id: string;
  name: string;
  participants: string[]; // Array of user IDs
  participantNames: string[]; // Array of user names
  createdBy: string;
  createdAt: Date;
}

export class MessagingService {
  private static STORAGE_KEY = 'crm_messages';
  private static GROUPS_KEY = 'crm_group_chats';

  // Get all messages
  private static getAllMessages(): Message[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save messages
  private static saveMessages(messages: Message[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
  }

  // Send a message
  static sendMessage(fromUserId: string, fromUserName: string, toUserId: string, toUserName: string, message: string): Message {
    const messages = this.getAllMessages();
    const newMessage: Message = {
      id: Date.now().toString(),
      fromUserId,
      fromUserName,
      toUserId,
      toUserName,
      message,
      timestamp: new Date(),
      isRead: false
    };
    messages.push(newMessage);
    this.saveMessages(messages);
    return newMessage;
  }

  // Get conversation between two users
  static getConversation(user1Id: string, user2Id: string): Message[] {
    const messages = this.getAllMessages();
    return messages
      .filter(m => 
        (m.fromUserId === user1Id && m.toUserId === user2Id) ||
        (m.fromUserId === user2Id && m.toUserId === user1Id)
      )
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Get all conversations for a user
  static getConversations(userId: string): Conversation[] {
    const messages = this.getAllMessages();
    const conversationMap = new Map<string, Conversation>();

    messages.forEach(message => {
      // Skip group messages
      if (message.groupId) return;

      let otherUserId: string;
      let otherUserName: string;

      if (message.fromUserId === userId && message.toUserId) {
        otherUserId = message.toUserId;
        otherUserName = message.toUserName!;
      } else if (message.toUserId === userId) {
        otherUserId = message.fromUserId;
        otherUserName = message.fromUserName;
      } else {
        return;
      }

      const existing = conversationMap.get(otherUserId);
      const messageTime = new Date(message.timestamp);

      if (!existing || new Date(existing.lastMessageTime!).getTime() < messageTime.getTime()) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName,
          lastMessage: message.message,
          lastMessageTime: messageTime,
          unreadCount: existing ? existing.unreadCount : 0
        });
      }

      // Count unread messages
      if (message.toUserId === userId && !message.isRead) {
        const conv = conversationMap.get(otherUserId)!;
        conv.unreadCount++;
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
  }

  // Mark messages as read
  static markAsRead(userId: string, otherUserId: string): void {
    const messages = this.getAllMessages();
    const now = new Date();
    messages.forEach(message => {
      if (message.toUserId === userId && message.fromUserId === otherUserId && !message.isRead) {
        message.isRead = true;
        message.seenAt = now;
      }
    });
    this.saveMessages(messages);
  }

  // Get total unread count
  static getUnreadCount(userId: string): number {
    const messages = this.getAllMessages();
    return messages.filter(m => m.toUserId === userId && !m.isRead).length;
  }

  // Group Chat Methods
  private static getAllGroups(): GroupChat[] {
    const data = localStorage.getItem(this.GROUPS_KEY);
    return data ? JSON.parse(data) : [];
  }

  private static saveGroups(groups: GroupChat[]): void {
    localStorage.setItem(this.GROUPS_KEY, JSON.stringify(groups));
  }

  // Create a group chat
  static createGroup(name: string, participantIds: string[], participantNames: string[], createdBy: string): GroupChat {
    const groups = this.getAllGroups();
    const newGroup: GroupChat = {
      id: Date.now().toString(),
      name,
      participants: participantIds,
      participantNames,
      createdBy,
      createdAt: new Date()
    };
    groups.push(newGroup);
    this.saveGroups(groups);
    return newGroup;
  }

  // Send message to group
  static sendGroupMessage(fromUserId: string, fromUserName: string, groupId: string, message: string): Message {
    const messages = this.getAllMessages();
    const newMessage: Message = {
      id: Date.now().toString(),
      fromUserId,
      fromUserName,
      groupId,
      message,
      timestamp: new Date(),
      isRead: false
    };
    messages.push(newMessage);
    this.saveMessages(messages);
    return newMessage;
  }

  // Get group messages
  static getGroupMessages(groupId: string): Message[] {
    const messages = this.getAllMessages();
    return messages
      .filter(m => m.groupId === groupId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Get user's groups
  static getUserGroups(userId: string): GroupChat[] {
    const groups = this.getAllGroups();
    return groups.filter(g => g.participants.includes(userId));
  }

  // Get conversations including groups
  static getAllConversations(userId: string): Conversation[] {
    const messages = this.getAllMessages();
    const conversationMap = new Map<string, Conversation>();

    // Get direct messages
    messages.forEach(message => {
      if (message.groupId) return; // Skip group messages for now

      let otherUserId: string;
      let otherUserName: string;

      if (message.fromUserId === userId) {
        otherUserId = message.toUserId!;
        otherUserName = message.toUserName!;
      } else if (message.toUserId === userId) {
        otherUserId = message.fromUserId;
        otherUserName = message.fromUserName;
      } else {
        return;
      }

      const existing = conversationMap.get(otherUserId);
      const messageTime = new Date(message.timestamp);

      if (!existing || new Date(existing.lastMessageTime!).getTime() < messageTime.getTime()) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName,
          lastMessage: message.message,
          lastMessageTime: messageTime,
          unreadCount: existing ? existing.unreadCount : 0,
          isGroup: false
        });
      }

      if (message.toUserId === userId && !message.isRead) {
        const conv = conversationMap.get(otherUserId)!;
        conv.unreadCount++;
      }
    });

    // Get group conversations
    const groups = this.getUserGroups(userId);
    groups.forEach(group => {
      const groupMessages = messages.filter(m => m.groupId === group.id);
      const lastMessage = groupMessages[groupMessages.length - 1];
      
      conversationMap.set(group.id, {
        groupId: group.id,
        groupName: group.name,
        participants: group.participants,
        lastMessage: lastMessage ? lastMessage.message : undefined,
        lastMessageTime: lastMessage ? new Date(lastMessage.timestamp) : group.createdAt,
        unreadCount: groupMessages.filter(m => m.fromUserId !== userId && !m.isRead).length,
        isGroup: true
      });
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
  }

  // Mark group messages as read
  static markGroupAsRead(userId: string, groupId: string): void {
    const messages = this.getAllMessages();
    const now = new Date();
    messages.forEach(message => {
      if (message.groupId === groupId && message.fromUserId !== userId && !message.isRead) {
        message.isRead = true;
        message.seenAt = now;
      }
    });
    this.saveMessages(messages);
  }

  // Add reaction to message
  static addReaction(messageId: string, userId: string, emoji: string): void {
    const messages = this.getAllMessages();
    const message = messages.find(m => m.id === messageId);
    if (message) {
      if (!message.reactions) {
        message.reactions = {};
      }
      message.reactions[userId] = emoji;
      this.saveMessages(messages);
    }
  }

  // Remove reaction from message
  static removeReaction(messageId: string, userId: string): void {
    const messages = this.getAllMessages();
    const message = messages.find(m => m.id === messageId);
    if (message && message.reactions) {
      delete message.reactions[userId];
      this.saveMessages(messages);
    }
  }

  // Edit message
  static editMessage(messageId: string, newText: string): void {
    const messages = this.getAllMessages();
    const message = messages.find(m => m.id === messageId);
    if (message) {
      message.message = newText;
      message.isEdited = true;
      message.editedAt = new Date();
      this.saveMessages(messages);
    }
  }

  // Delete message
  static deleteMessage(messageId: string): void {
    const messages = this.getAllMessages();
    const message = messages.find(m => m.id === messageId);
    if (message) {
      message.isDeleted = true;
      message.message = 'This message was deleted';
      this.saveMessages(messages);
    }
  }

  // Copy message text
  static copyMessage(message: Message): string {
    return message.message;
  }

  // Delete conversation (remove all messages)
  static deleteConversation(userId: string, otherUserId?: string, groupId?: string): void {
    let messages = this.getAllMessages();
    
    if (groupId) {
      // Delete group conversation
      messages = messages.filter(m => m.groupId !== groupId);
      
      // Also remove the group
      const groups = this.getAllGroups();
      const updatedGroups = groups.filter(g => g.id !== groupId);
      localStorage.setItem(this.GROUPS_KEY, JSON.stringify(updatedGroups));
    } else if (otherUserId) {
      // Delete direct conversation
      messages = messages.filter(m => 
        !((m.fromUserId === userId && m.toUserId === otherUserId) ||
          (m.fromUserId === otherUserId && m.toUserId === userId))
      );
    }
    
    this.saveMessages(messages);
  }

  // Archive/Unarchive conversation
  static toggleArchiveConversation(otherUserId?: string, groupId?: string): void {
    const ARCHIVE_KEY = 'crm_archived_conversations';
    const archived = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    const conversationKey = groupId ? `group_${groupId}` : `user_${otherUserId}`;
    
    const index = archived.indexOf(conversationKey);
    if (index > -1) {
      // Unarchive
      archived.splice(index, 1);
    } else {
      // Archive
      archived.push(conversationKey);
    }
    
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(archived));
  }

  // Check if conversation is archived
  static isConversationArchived(otherUserId?: string, groupId?: string): boolean {
    const ARCHIVE_KEY = 'crm_archived_conversations';
    const archived = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
    const conversationKey = groupId ? `group_${groupId}` : `user_${otherUserId}`;
    return archived.includes(conversationKey);
  }
}
