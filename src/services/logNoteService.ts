import type { LogNote, LogReply } from '../types/logNote';

export class LogNoteService {
  private static readonly STORAGE_KEY = 'crm_log_notes';
  private static logNoteCounter = 1;
  private static replyCounter = 1;

  // Load from localStorage
  private static loadFromStorage(): Map<string, LogNote[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        // Convert dates back to Date objects
        Object.keys(data).forEach(clientId => {
          data[clientId] = data[clientId].map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp),
            replies: log.replies.map((reply: any) => ({
              ...reply,
              timestamp: new Date(reply.timestamp)
            }))
          }));
        });
        return new Map(Object.entries(data));
      }
    } catch (error) {
      console.error('Error loading log notes from storage:', error);
    }
    return new Map();
  }

  // Save to localStorage
  private static saveToStorage(logNotes: Map<string, LogNote[]>): void {
    try {
      const data = Object.fromEntries(logNotes);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving log notes to storage:', error);
    }
  }

  // Initialize counters based on existing data
  private static initializeCounters(): void {
    const logNotes = this.loadFromStorage();
    let maxLogId = 0;
    let maxReplyId = 0;
    
    logNotes.forEach(logs => {
      logs.forEach(log => {
        const logId = parseInt(log.id.replace('log_', ''));
        if (logId > maxLogId) maxLogId = logId;
        
        log.replies.forEach(reply => {
          const replyId = parseInt(reply.id.replace('reply_', ''));
          if (replyId > maxReplyId) maxReplyId = replyId;
        });
      });
    });
    
    this.logNoteCounter = maxLogId + 1;
    this.replyCounter = maxReplyId + 1;
  }

  static addLogNote(
    clientId: string,
    userId: string,
    userName: string,
    type: 'auto' | 'manual',
    action: string,
    description: string,
    status: 'pending' | 'done' | 'on hold' = 'pending',
    fieldChanged?: string,
    oldValue?: string,
    newValue?: string
  ): LogNote {
    // Initialize counters on first use
    if (this.logNoteCounter === 1) {
      this.initializeCounters();
    }

    const logNote: LogNote = {
      id: `log_${this.logNoteCounter++}`,
      clientId,
      userId,
      userName,
      timestamp: new Date(),
      type,
      action,
      description,
      status,
      fieldChanged,
      oldValue,
      newValue,
      replies: []
    };

    const logNotes = this.loadFromStorage();
    const clientLogs = logNotes.get(clientId) || [];
    clientLogs.unshift(logNote); // Add to beginning for newest first
    logNotes.set(clientId, clientLogs);
    this.saveToStorage(logNotes);

    return logNote;
  }

  static addReply(
    logNoteId: string,
    clientId: string,
    userId: string,
    userName: string,
    message: string
  ): LogReply | null {
    const logNotes = this.loadFromStorage();
    const clientLogs = logNotes.get(clientId) || [];
    const logNote = clientLogs.find(log => log.id === logNoteId);
    
    if (!logNote) return null;

    const reply: LogReply = {
      id: `reply_${this.replyCounter++}`,
      logNoteId,
      userId,
      userName,
      timestamp: new Date(),
      message
    };

    logNote.replies.push(reply);
    logNotes.set(clientId, clientLogs);
    this.saveToStorage(logNotes);

    return reply;
  }

  static updateLogNoteStatus(
    logNoteId: string,
    clientId: string,
    status: 'pending' | 'done' | 'on hold'
  ): boolean {
    const logNotes = this.loadFromStorage();
    const clientLogs = logNotes.get(clientId) || [];
    const logNote = clientLogs.find(log => log.id === logNoteId);
    
    if (!logNote) return false;

    logNote.status = status;
    logNotes.set(clientId, clientLogs);
    this.saveToStorage(logNotes);

    return true;
  }

  static getLogNotes(clientId: string): LogNote[] {
    const logNotes = this.loadFromStorage();
    return logNotes.get(clientId) || [];
  }

  static logFieldChange(
    clientId: string,
    userId: string,
    userName: string,
    fieldName: string,
    oldValue: string,
    newValue: string
  ): LogNote {
    return this.addLogNote(
      clientId,
      userId,
      userName,
      'auto',
      'Field Updated',
      `${fieldName} changed from "${oldValue}" to "${newValue}"`,
      'done',
      fieldName,
      oldValue,
      newValue
    );
  }

  static logClientAction(
    clientId: string,
    userId: string,
    userName: string,
    action: string,
    description: string,
    status: 'pending' | 'done' | 'on hold' = 'done'
  ): LogNote {
    return this.addLogNote(
      clientId,
      userId,
      userName,
      'auto',
      action,
      description,
      status
    );
  }

  static logSectionUpdate(
    clientId: string,
    userId: string,
    userName: string,
    sectionName: string,
    description: string,
    status: 'pending' | 'done' | 'on hold' = 'done'
  ): LogNote {
    return this.addLogNote(
      clientId,
      userId,
      userName,
      'auto',
      `Section Updated: ${sectionName}`,
      description,
      status
    );
  }
}