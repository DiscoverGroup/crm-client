export interface LogNoteAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  r2Path: string;
  url: string;
  uploadDate: string;
}

export interface LogNote {
  id: string;
  clientId: string;
  userId: string;
  userName: string;
  timestamp: Date;
  type: 'auto' | 'manual';
  action: string;
  description: string;
  status: 'pending' | 'done' | 'on hold';
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
  replies: LogReply[];
  parentActivityLogId?: string;
  attachments?: LogNoteAttachment[];
  statusChangedAt?: Date;
  statusChangedBy?: string;
}

export interface LogReply {
  id: string;
  logNoteId: string;
  userId: string;
  userName: string;
  timestamp: Date;
  message: string;
  replies?: LogReply[];
  attachments?: LogNoteAttachment[];
}

export interface LogNoteFormData {
  message: string;
  status: 'pending' | 'done' | 'on hold';
}