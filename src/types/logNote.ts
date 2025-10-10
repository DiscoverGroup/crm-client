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
}

export interface LogReply {
  id: string;
  logNoteId: string;
  userId: string;
  userName: string;
  timestamp: Date;
  message: string;
}

export interface LogNoteFormData {
  message: string;
  status: 'pending' | 'done' | 'on hold';
}