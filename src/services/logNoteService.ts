import type { LogNote, LogReply } from '../types/logNote';

export class LogNoteService {
  private static logNotes: Map<string, LogNote[]> = new Map();
  private static logNoteCounter = 1;
  private static replyCounter = 1;

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

    const clientLogs = this.logNotes.get(clientId) || [];
    clientLogs.unshift(logNote); // Add to beginning for newest first
    this.logNotes.set(clientId, clientLogs);

    return logNote;
  }

  static addReply(
    logNoteId: string,
    clientId: string,
    userId: string,
    userName: string,
    message: string
  ): LogReply | null {
    const clientLogs = this.logNotes.get(clientId) || [];
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
    this.logNotes.set(clientId, clientLogs);

    return reply;
  }

  static updateLogNoteStatus(
    logNoteId: string,
    clientId: string,
    status: 'pending' | 'done' | 'on hold'
  ): boolean {
    const clientLogs = this.logNotes.get(clientId) || [];
    const logNote = clientLogs.find(log => log.id === logNoteId);
    
    if (!logNote) return false;

    logNote.status = status;
    this.logNotes.set(clientId, clientLogs);

    return true;
  }

  static getLogNotes(clientId: string): LogNote[] {
    return this.logNotes.get(clientId) || [];
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