// Activity Log Service for tracking all client-related activities

export interface ActivityLog {
  id: string;
  clientId: string;
  clientName: string;
  action: 'created' | 'edited' | 'deleted' | 'recovered' | 'permanently_deleted';
  performedBy: string;
  performedByUser: string; // Full name
  timestamp: string;
  details?: string;
  changes?: Record<string, { old: any; new: any }>;
}

export class ActivityLogService {
  private static readonly STORAGE_KEY = 'crm_activity_logs';

  static addLog(log: Omit<ActivityLog, 'id' | 'timestamp'>): void {
    const logs = this.getAllLogs();
    const newLog: ActivityLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    logs.unshift(newLog); // Add to beginning for most recent first
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
  }

  static getAllLogs(): ActivityLog[] {
    const logsJson = localStorage.getItem(this.STORAGE_KEY);
    return logsJson ? JSON.parse(logsJson) : [];
  }

  static getLogsByClient(clientId: string): ActivityLog[] {
    const allLogs = this.getAllLogs();
    return allLogs.filter(log => log.clientId === clientId);
  }

  static getRecentLogs(limit: number = 50): ActivityLog[] {
    const allLogs = this.getAllLogs();
    return allLogs.slice(0, limit);
  }

  static clearOldLogs(daysToKeep: number = 90): void {
    const allLogs = this.getAllLogs();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const filteredLogs = allLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= cutoffDate;
    });
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredLogs));
  }
}
