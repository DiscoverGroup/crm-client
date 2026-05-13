export interface Notification {
  id: string;
  type: 'mention' | 'comment' | 'status_change' | 'file_upload' | 'client_update' | 'recovery_approved' | 'recovery_rejected' | 'new_sale' | 'new_bc';
  title: string;
  message: string;
  targetUserId: string; // Who receives this notification
  targetUserName: string;
  fromUserId: string;
  fromUserName: string;
  clientId?: string;
  clientName?: string;
  logNoteId?: string;
  activityLogId?: string;
  isRead: boolean;
  timestamp: Date;
  link?: {
    page: 'client-form' | 'activity-log' | 'log-notes';
    clientId?: string;
    noteId?: string;
    scrollTo?: string;
  };
}
