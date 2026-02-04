import type { Notification } from '../types/notification';

export class NotificationService {
  private static readonly STORAGE_KEY = 'crm_notifications';

  static addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): void {
    const notifications = this.getAllNotifications();
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      isRead: false
    };
    
    notifications.unshift(newNotification); // Add to beginning
    
    // Keep only last 100 notifications per user
    const userNotifs = notifications.filter(n => n.targetUserId === notification.targetUserId);
    if (userNotifs.length > 100) {
      const toRemove = userNotifs.slice(100).map(n => n.id);
      const filtered = notifications.filter(n => !toRemove.includes(n.id));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } else {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    }
  }

  static getAllNotifications(): Notification[] {
    const notifsJson = localStorage.getItem(this.STORAGE_KEY);
    if (!notifsJson) return [];
    
    const notifications = JSON.parse(notifsJson);
    // Convert timestamp strings back to Date objects
    return notifications.map((n: any) => ({
      ...n,
      timestamp: new Date(n.timestamp)
    }));
  }

  static getUserNotifications(userId: string, limit?: number): Notification[] {
    const allNotifications = this.getAllNotifications();
    const userNotifs = allNotifications.filter(n => n.targetUserId === userId);
    return limit ? userNotifs.slice(0, limit) : userNotifs;
  }

  static getUnreadCount(userId: string): number {
    const userNotifs = this.getUserNotifications(userId);
    return userNotifs.filter(n => !n.isRead).length;
  }

  static markAsRead(notificationId: string): void {
    const notifications = this.getAllNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.isRead = true;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    }
  }

  static markAllAsRead(userId: string): void {
    const notifications = this.getAllNotifications();
    notifications.forEach(n => {
      if (n.targetUserId === userId) {
        n.isRead = true;
      }
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
  }

  static deleteNotification(notificationId: string): void {
    const notifications = this.getAllNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
  }

  // Helper: Create mention notification
  static createMentionNotification(params: {
    mentionedUsername: string;
    fromUserId: string;
    fromUserName: string;
    clientId: string;
    clientName: string;
    logNoteId?: string;
    commentText: string;
  }): void {
    // Find the mentioned user
    const users = localStorage.getItem('crm_users');
    if (!users) return;
    
    const userList = JSON.parse(users);
    const mentionedUser = userList.find((u: any) => u.username === params.mentionedUsername);
    
    if (!mentionedUser) return;

    this.addNotification({
      type: 'mention',
      title: '💬 New Mention',
      message: `${params.fromUserName} mentioned you in a comment: "${params.commentText.substring(0, 50)}${params.commentText.length > 50 ? '...' : ''}"`,
      targetUserId: mentionedUser.fullName,
      targetUserName: mentionedUser.fullName,
      fromUserId: params.fromUserId,
      fromUserName: params.fromUserName,
      clientId: params.clientId,
      clientName: params.clientName,
      logNoteId: params.logNoteId,
      link: {
        page: 'log-notes',
        clientId: params.clientId,
        noteId: params.logNoteId,
        scrollTo: params.logNoteId
      }
    });
  }
}
