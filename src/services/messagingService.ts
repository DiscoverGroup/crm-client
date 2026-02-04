export interface Message {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
}

export interface Conversation {
  userId: string;
  userName: string;
  lastMessage?: string;
  lastMessageTime?: Date;
  unreadCount: number;
}

export class MessagingService {
  private static STORAGE_KEY = 'crm_messages';

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
      let otherUserId: string;
      let otherUserName: string;

      if (message.fromUserId === userId) {
        otherUserId = message.toUserId;
        otherUserName = message.toUserName;
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
    messages.forEach(message => {
      if (message.toUserId === userId && message.fromUserId === otherUserId && !message.isRead) {
        message.isRead = true;
      }
    });
    this.saveMessages(messages);
  }

  // Get total unread count
  static getUnreadCount(userId: string): number {
    const messages = this.getAllMessages();
    return messages.filter(m => m.toUserId === userId && !m.isRead).length;
  }

  // Delete conversation
  static deleteConversation(user1Id: string, user2Id: string): void {
    const messages = this.getAllMessages();
    const filtered = messages.filter(m => 
      !((m.fromUserId === user1Id && m.toUserId === user2Id) ||
        (m.fromUserId === user2Id && m.toUserId === user1Id))
    );
    this.saveMessages(filtered);
  }
}
