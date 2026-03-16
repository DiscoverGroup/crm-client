import type { Notification } from '../types/notification';
import { authHeaders } from '../utils/authToken';

const DB_API = '/.netlify/functions/database';

export class NotificationService {
  private static readonly STORAGE_KEY = 'crm_notifications';
  private static readonly LAST_SYNC_KEY = 'crm_notifications_last_sync';
  private static syncInProgress = false;

  static addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>): void {
    const notifications = this.getAllNotifications();
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
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

    // Fire-and-forget sync to MongoDB
    this.saveNotificationToMongoDB(newNotification).catch(() => {});
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
      // Sync to MongoDB
      this.updateNotificationInMongoDB(notificationId, { isRead: true }).catch(() => {});
    }
  }

  static markAllAsRead(userId: string): void {
    const notifications = this.getAllNotifications();
    const updatedIds: string[] = [];
    notifications.forEach(n => {
      if (n.targetUserId === userId && !n.isRead) {
        n.isRead = true;
        updatedIds.push(n.id);
      }
    });
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(notifications));
    // Sync each to MongoDB
    for (const id of updatedIds) {
      this.updateNotificationInMongoDB(id, { isRead: true }).catch(() => {});
    }
  }

  static deleteNotification(notificationId: string): void {
    const notifications = this.getAllNotifications();
    const filtered = notifications.filter(n => n.id !== notificationId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    // Sync deletion to MongoDB
    this.deleteNotificationFromMongoDB(notificationId).catch(() => {});
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
    // console.log('🔔 Creating mention notification for:', params.mentionedUsername);
    
    // Find the mentioned user
    const users = localStorage.getItem('crm_users');
    if (!users) {
      // console.log('❌ No users found in localStorage');
      return;
    }
    
    const userList = JSON.parse(users);
    // console.log('📋 All users:', userList.map((u: any) => u.username));
    
    const mentionedUser = userList.find((u: any) => 
      u.username.toLowerCase() === params.mentionedUsername.toLowerCase()
    );
    
    if (!mentionedUser) {
      // console.log('❌ User not found:', params.mentionedUsername);
      return;
    }

    // console.log('✅ Found user:', mentionedUser.fullName, '- Creating notification');

    this.addNotification({
      type: 'mention',
      title: '💬 New Mention',
      message: `${params.fromUserName} mentioned you in a comment: "${params.commentText.substring(0, 50)}${params.commentText.length > 50 ? '...' : ''}"`,
      targetUserId: mentionedUser.id ?? mentionedUser.email ?? mentionedUser.fullName,
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
    
    // console.log('✅ Notification created successfully');
  }

  // ─── MongoDB Sync ─────────────────────────────────────────────────────

  static async syncFromMongoDB(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const response = await fetch(DB_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'notifications',
          operation: 'find',
          filter: {}
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const mongoNotifications: Notification[] = result.data.map((d: any) => ({
          id: d.id,
          type: d.type,
          title: d.title,
          message: d.message,
          targetUserId: d.targetUserId,
          targetUserName: d.targetUserName,
          fromUserId: d.fromUserId,
          fromUserName: d.fromUserName,
          clientId: d.clientId,
          clientName: d.clientName,
          logNoteId: d.logNoteId,
          activityLogId: d.activityLogId,
          isRead: d.isRead,
          timestamp: new Date(d.timestamp),
          link: d.link
        }));

        // Merge: MongoDB + local-only
        const mongoIds = new Set(mongoNotifications.map(n => n.id));
        const localOnly = this.getAllNotifications().filter(n => !mongoIds.has(n.id));

        // Re-sync local-only to MongoDB
        for (const notif of localOnly) {
          this.saveNotificationToMongoDB(notif).catch(() => {});
        }

        const merged = [...localOnly, ...mongoNotifications];
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      }
    } catch {
      // Network error — keep localStorage data
    } finally {
      this.syncInProgress = false;
    }
  }

  private static async saveNotificationToMongoDB(notification: Notification): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'notifications',
        operation: 'updateOne',
        filter: { id: notification.id },
        update: {
          ...notification,
          timestamp: notification.timestamp instanceof Date 
            ? notification.timestamp.toISOString() 
            : notification.timestamp
        },
        upsert: true
      })
    });
  }

  private static async updateNotificationInMongoDB(notificationId: string, update: Record<string, any>): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'notifications',
        operation: 'updateOne',
        filter: { id: notificationId },
        update
      })
    });
  }

  private static async deleteNotificationFromMongoDB(notificationId: string): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'notifications',
        operation: 'deleteOne',
        filter: { id: notificationId }
      })
    });
  }
}
