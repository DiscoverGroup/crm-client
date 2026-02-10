export interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId?: string; // Optional for group messages
  toUserName?: string; // Optional for group messages
  groupId?: string; // For group messages
  content: string; // Changed from 'message' to 'content' for backend consistency
  timestamp: string | Date;
  isRead: boolean;
  seenAt?: Date; // When the message was seen
  reactions?: { [userId: string]: string }; // userId -> emoji
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
  replyTo?: string; // ID of message being replied to
  deliveryStatus?: 'sending' | 'sent' | 'delivered' | 'failed'; // Message delivery status
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
  isPinned?: boolean; // Whether conversation is pinned
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
  private static API_BASE = '/.netlify/functions';
  private static STORAGE_KEY = 'crm_messages'; // Fallback for offline mode
  private static GROUPS_KEY = 'crm_group_chats'; // Fallback for offline mode

  // Helper to make API calls
  private static async apiCall(endpoint: string, data: any): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'API call failed');
      }
      return result.data;
    } catch (error) {
      // console.error(`API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // Get all messages (fallback for localStorage)
  private static getAllMessages(): Message[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save messages (fallback for localStorage)
  private static saveMessages(messages: Message[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(messages));
  }

  // Send a message
  static async sendMessage(
    fromUserId: string, 
    fromUserName: string, 
    toUserId: string, 
    toUserName: string, 
    content: string,
    replyTo?: string
  ): Promise<Message> {
    try {
      const messageData = {
        id: Date.now().toString(),
        fromUserId,
        fromUserName,
        toUserId,
        toUserName,
        content,
        timestamp: new Date().toISOString(),
        isRead: false,
        replyTo
      };

      const result = await this.apiCall('send-message', messageData);
      return result;
    } catch (error) {
      // Fallback to localStorage if API fails
      // console.warn('Falling back to localStorage for sendMessage');
      const messages = this.getAllMessages();
      const newMessage: Message = {
        id: Date.now().toString(),
        fromUserId,
        fromUserName,
        toUserId,
        toUserName,
        content,
        timestamp: new Date().toISOString(), // Use ISO string for consistency
        isRead: false,
        replyTo
      };
      messages.push(newMessage);
      this.saveMessages(messages);
      return newMessage;
    }
  }

  // Get conversation between two users
  static async getConversation(user1Id: string, user2Id: string): Promise<Message[]> {
    try {
      const messages = await this.apiCall('get-messages', {
        userId: user1Id,
        otherUserId: user2Id
      });
      return messages.sort((a: Message, b: Message) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for getConversation');
      const messages = this.getAllMessages();
      return messages
        .filter(m => 
          (m.fromUserId === user1Id && m.toUserId === user2Id) ||
          (m.fromUserId === user2Id && m.toUserId === user1Id)
        )
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  }

  // Get all conversations for a user
  static async getConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversations = await this.apiCall('get-conversations', { userId });
      return conversations.sort((a: Conversation, b: Conversation) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for getConversations');
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
            lastMessage: message.content,
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
  }

  // Mark messages as read
  static async markAsRead(userId: string, otherUserId: string): Promise<void> {
    try {
      await this.apiCall('mark-as-read', { userId, otherUserId });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for markAsRead');
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
  }

  // Get total unread count
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const conversations = await this.getConversations(userId);
      return conversations.reduce((total, conv) => total + conv.unreadCount, 0);
    } catch (error) {
      // Fallback to localStorage
      const messages = this.getAllMessages();
      return messages.filter(m => m.toUserId === userId && !m.isRead).length;
    }
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
  static async createGroup(name: string, participantIds: string[], participantNames: string[], createdBy: string): Promise<GroupChat> {
    try {
      const groupData = {
        name,
        participantIds,
        participantNames,
        createdBy
      };
      
      const result = await this.apiCall('create-group', groupData);
      return result;
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for createGroup');
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
  }

  // Send message to group
  static async sendGroupMessage(fromUserId: string, fromUserName: string, groupId: string, content: string, replyTo?: string): Promise<Message> {
    try {
      const messageData = {
        id: Date.now().toString(),
        fromUserId,
        fromUserName,
        groupId,
        content,
        timestamp: new Date().toISOString(),
        isRead: false,
        replyTo
      };

      const result = await this.apiCall('send-message', messageData);
      return result;
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for sendGroupMessage');
      const messages = this.getAllMessages();
      const newMessage: Message = {
        id: Date.now().toString(),
        fromUserId,
        fromUserName,
        groupId,
        content,
        timestamp: new Date().toISOString(), // Use ISO string for consistency
        isRead: false,
        replyTo
      };
      messages.push(newMessage);
      this.saveMessages(messages);
      return newMessage;
    }
  }

  // Get group messages
  static async getGroupMessages(userId: string, groupId: string): Promise<Message[]> {
    try {
      const messages = await this.apiCall('get-messages', {
        userId, // Required by backend validation
        groupId
      });
      return messages.sort((a: Message, b: Message) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for getGroupMessages');
      const messages = this.getAllMessages();
      return messages
        .filter(m => m.groupId === groupId)
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
  }

  // Get user's groups
  static getUserGroups(userId: string): GroupChat[] {
    const groups = this.getAllGroups();
    return groups.filter(g => g.participants.includes(userId));
  }

  // Get conversations including groups
  static async getAllConversations(userId: string): Promise<Conversation[]> {
    try {
      const conversations = await this.apiCall('get-conversations', { userId });
      return conversations.sort((a: Conversation, b: Conversation) => {
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for getAllConversations');
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
            lastMessage: message.content,
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
          lastMessage: lastMessage ? lastMessage.content : undefined,
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
  }

  // Mark group messages as read
  static async markGroupAsRead(userId: string, groupId: string): Promise<void> {
    try {
      await this.apiCall('mark-as-read', { userId, groupId });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for markGroupAsRead');
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
  }

  // Add reaction to message
  static async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    try {
      await this.apiCall('add-reaction', { messageId, userId, emoji });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for addReaction');
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
  }

  // Remove reaction from message
  static async removeReaction(messageId: string, userId: string): Promise<void> {
    try {
      await this.apiCall('remove-reaction', { messageId, userId });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for removeReaction');
      const messages = this.getAllMessages();
      const message = messages.find(m => m.id === messageId);
      if (message && message.reactions) {
        delete message.reactions[userId];
        this.saveMessages(messages);
      }
    }
  }

  // Edit message
  static async editMessage(messageId: string, newText: string): Promise<void> {
    try {
      await this.apiCall('edit-message', { messageId, newText });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for editMessage');
      const messages = this.getAllMessages();
      const message = messages.find(m => m.id === messageId);
      if (message) {
        message.content = newText;
        message.isEdited = true;
        message.editedAt = new Date();
        this.saveMessages(messages);
      }
    }
  }

  // Delete message
  static async deleteMessage(messageId: string): Promise<void> {
    try {
      await this.apiCall('delete-message', { messageId });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for deleteMessage');
      const messages = this.getAllMessages();
      const message = messages.find(m => m.id === messageId);
      if (message) {
        message.isDeleted = true;
        message.content = 'This message was deleted';
        this.saveMessages(messages);
      }
    }
  }

  // Copy message text
  static copyMessage(message: Message): string {
    return message.content;
  }

  // Delete conversation (remove all messages)
  static async deleteConversation(userId: string, otherUserId?: string, groupId?: string): Promise<void> {
    try {
      await this.apiCall('delete-conversation', { userId, otherUserId, groupId });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for deleteConversation');
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
  }

  // Archive/Unarchive conversation
  static async toggleArchiveConversation(otherUserId?: string, groupId?: string): Promise<void> {
    try {
      // Get current user from localStorage (temporary solution)
      const userData = localStorage.getItem('currentUser');
      if (!userData) return;
      const userId = JSON.parse(userData).id;

      await this.apiCall('conversation-action', {
        userId,
        otherUserId,
        groupId,
        action: 'toggleArchive'
      });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for toggleArchiveConversation');
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
  }

  // Check if conversation is archived
  static async isConversationArchived(otherUserId?: string, groupId?: string): Promise<boolean> {
    try {
      const userData = localStorage.getItem('currentUser');
      if (!userData) return false;
      const userId = JSON.parse(userData).id;

      const result = await this.apiCall('conversation-action', {
        userId,
        otherUserId,
        groupId,
        action: 'isArchived'
      });
      return result;
    } catch (error) {
      // Fallback to localStorage
      const ARCHIVE_KEY = 'crm_archived_conversations';
      const archived = JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]');
      const conversationKey = groupId ? `group_${groupId}` : `user_${otherUserId}`;
      return archived.includes(conversationKey);
    }
  }

  // Pin/Unpin conversation
  static async togglePinConversation(otherUserId?: string, groupId?: string): Promise<void> {
    try {
      const userData = localStorage.getItem('currentUser');
      if (!userData) return;
      const userId = JSON.parse(userData).id;

      await this.apiCall('conversation-action', {
        userId,
        otherUserId,
        groupId,
        action: 'togglePin'
      });
    } catch (error) {
      // Fallback to localStorage
      // console.warn('Falling back to localStorage for togglePinConversation');
      const PIN_KEY = 'crm_pinned_conversations';
      const pinned = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
      const conversationKey = groupId ? `group_${groupId}` : `user_${otherUserId}`;
      
      const index = pinned.indexOf(conversationKey);
      if (index > -1) {
        // Unpin
        pinned.splice(index, 1);
      } else {
        // Pin
        pinned.push(conversationKey);
      }
      
      localStorage.setItem(PIN_KEY, JSON.stringify(pinned));
    }
  }

  // Check if conversation is pinned
  static async isConversationPinned(otherUserId?: string, groupId?: string): Promise<boolean> {
    try {
      const userData = localStorage.getItem('currentUser');
      if (!userData) return false;
      const userId = JSON.parse(userData).id;

      const result = await this.apiCall('conversation-action', {
        userId,
        otherUserId,
        groupId,
        action: 'isPinned'
      });
      return result;
    } catch (error) {
      // Fallback to localStorage
      const PIN_KEY = 'crm_pinned_conversations';
      const pinned = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
      const conversationKey = groupId ? `group_${groupId}` : `user_${otherUserId}`;
      return pinned.includes(conversationKey);
    }
  }
}
