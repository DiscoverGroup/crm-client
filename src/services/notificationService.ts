import type { Notification } from '../types/notification';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from './realtimeSyncService';

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

    // Signal same-browser tabs immediately (BroadcastChannel, zero latency)
    realtimeSync.signalChange('notifications').catch(() => {});

    // Persist to MongoDB, then re-signal so other devices pick it up via
    // the sync_metadata timestamp update (the first signalChange above only
    // broadcasts to same-browser tabs before the DB write completes).
    this.saveNotificationToMongoDB(newNotification).then(() => {
      realtimeSync.signalChange('notifications');
    }).catch(() => {});
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

  static async syncFromMongoDB(userId?: string): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      console.log('[NOTIF-SYNC] Fetching notifications from MongoDB...');
      const filter = userId ? { targetUserId: userId } : {};
      const response = await fetch(DB_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'notifications',
          operation: 'find',
          filter
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        console.log('[NOTIF-SYNC] MongoDB returned', result.data.length, 'notifications');
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

        // Merge: MongoDB + any local notifications for this user not yet in MongoDB.
        // When userId-scoped, only compare the current user's local notifs —
        // never touch other users' notifications (they ARE in MongoDB, just not fetched).
        const mongoIds = new Set(mongoNotifications.map(n => n.id));
        const allLocal = this.getAllNotifications();
        const localScopeForUser = userId
          ? allLocal.filter(n => n.targetUserId === userId)
          : allLocal;
        const localOnly = localScopeForUser.filter(n => !mongoIds.has(n.id));

        // Re-sync any genuinely local-only (created offline) to MongoDB
        for (const notif of localOnly) {
          this.saveNotificationToMongoDB(notif).catch(() => {});
        }

        // Rebuild localStorage: keep other users' notifs + merge current user's
        const otherUsersNotifs = userId
          ? allLocal.filter(n => n.targetUserId !== userId)
          : [];
        const merged = [...localOnly, ...mongoNotifications, ...otherUsersNotifs];
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
        console.log('[NOTIF-SYNC] Merged', merged.length, 'total notifications into localStorage');
      }
    } catch (e) {
      console.error('[NOTIF-SYNC] syncFromMongoDB failed:', e);
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

  // ─── Broadcast helpers ────────────────────────────────────────────────────

  /** Return all registered users from localStorage */
  private static getAllUsers(): Array<{ id?: string; email?: string; fullName?: string; username?: string }> {
    try {
      const raw = localStorage.getItem('crm_users');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Create a notification for every user except the one who triggered the event.
   * fromUserId / fromUserName = the acting user.
   * targetUserId is stored as fullName to match getUserNotifications lookup.
   */
  private static broadcastToAllUsers(params: {
    type: 'new_sale' | 'new_bc' | 'client_update';
    title: string;
    message: string;
    fromUserId: string;
    fromUserName: string;
    clientId?: string;
    clientName?: string;
    scrollTo?: string;
  }): void {
    const users = this.getAllUsers();
    console.log('[NOTIF-BROADCAST] Broadcasting', params.type, '— users in crm_users:', users.length, users.map(u => u.fullName ?? u.username));
    for (const user of users) {
      // Use fullName as targetUserId — matches getUserNotifications(currentUser.fullName)
      const targetName = user.fullName ?? user.username ?? '';
      if (!targetName || targetName === params.fromUserName) continue;
      this.addNotification({
        type: params.type,
        title: params.title,
        message: params.message,
        targetUserId: targetName,
        targetUserName: targetName,
        fromUserId: params.fromUserId,
        fromUserName: params.fromUserName,
        clientId: params.clientId,
        clientName: params.clientName,
        link: params.clientId
          ? { page: 'client-form', clientId: params.clientId, scrollTo: params.scrollTo }
          : undefined,
      });
    }
  }

  /** Broadcast "New Sale added" to all users */
  static createNewSaleNotification(params: {
    fromUserId: string;
    fromUserName: string;
    clientId: string;
    clientName: string;
  }): void {
    this.broadcastToAllUsers({
      type: 'new_sale',
      title: '🎉 New Sales',
      message: `${params.fromUserName} added a new sale: ${params.clientName}`,
      fromUserId: params.fromUserId,
      fromUserName: params.fromUserName,
      clientId: params.clientId,
      clientName: params.clientName,
    });
  }

  /** Broadcast "New BC uploaded" to all users */
  static createNewBCNotification(params: {
    fromUserId: string;
    fromUserName: string;
    clientId: string;
    clientName: string;
  }): void {
    this.broadcastToAllUsers({
      type: 'new_bc',
      title: '📄 New BC Uploaded',
      message: `New BC for ${params.clientName} has been uploaded by ${params.fromUserName}`,
      fromUserId: params.fromUserId,
      fromUserName: params.fromUserName,
      clientId: params.clientId,
      clientName: params.clientName,
    });
  }

  /** Broadcast "Client updated" to all users for any section save/edit */
  static createClientUpdateNotification(params: {
    fromUserId: string;
    fromUserName: string;
    clientId: string;
    clientName: string;
    section: string;
  }): void {
    // Map section name to the DOM element id for scroll-to on click
    const SECTION_ID_MAP: Record<string, string> = {
      'Client Information': 'section-client-info',
      'Package & Companions': 'section-package',
      'Payment Details': 'section-payment',
      'Account Relations': 'section-account-relations',
      'After Sales SC': 'section-after-sales-sc',
      'After Visa SC': 'section-after-visa-sc',
      'Pre-Departure SC': 'section-pre-departure-sc',
      'Post-Departure SC': 'section-post-departure-sc',
      'Visa Information': 'section-visa',
      'Embassy Information': 'section-embassy',
    };
    this.broadcastToAllUsers({
      type: 'client_update',
      title: '📝 Client Updated',
      message: `${params.fromUserName} updated ${params.section} for ${params.clientName}`,
      fromUserId: params.fromUserId,
      fromUserName: params.fromUserName,
      clientId: params.clientId,
      clientName: params.clientName,
      scrollTo: SECTION_ID_MAP[params.section] ?? 'section-client-info',
    });
  }
}

