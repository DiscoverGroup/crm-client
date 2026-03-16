// Activity Log Service for tracking all client-related activities
// Syncs to MongoDB for cross-device access, with localStorage as cache/fallback

import { authHeaders } from '../utils/authToken';

export interface ActivityLog {
  id: string;
  clientId: string;
  clientName: string;
  action: 'created' | 'edited' | 'deleted' | 'recovered' | 'permanently_deleted' | 'file_uploaded' | 'file_deleted' | 'file_recovered' | 'file_recovery_rejected' | 'client_recovery_rejected';
  performedBy: string;
  performedByUser: string; // Full name
  profileImageR2Path?: string; // R2 path for user profile image
  timestamp: string;
  details?: string;
  changes?: Record<string, { old: any; new: any }>;
}

const DB_API = '/.netlify/functions/database';

export class ActivityLogService {
  private static readonly STORAGE_KEY = 'crm_activity_logs';
  private static readonly LAST_SYNC_KEY = 'crm_activity_logs_last_sync';
  private static syncInProgress = false;

  // ─── Add log to both localStorage and MongoDB ──────────────────────────
  static addLog(log: Omit<ActivityLog, 'id' | 'timestamp'>): void {
    const newLog: ActivityLog = {
      ...log,
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString()
    };

    // Save to localStorage immediately for instant UI
    const logs = this.getLocalLogs();
    logs.unshift(newLog);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));

    // Fire-and-forget sync to MongoDB
    this.saveToMongoDB(newLog).catch(() => {
      // Silently fail — localStorage has the data
    });
  }

  // ─── Get all logs (from localStorage cache) ───────────────────────────
  static getAllLogs(): ActivityLog[] {
    return this.getLocalLogs();
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

    // Also delete old logs from MongoDB
    this.deleteOldFromMongoDB(cutoffDate.toISOString()).catch(() => {});
  }

  // ─── Sync from MongoDB → localStorage (call on app load) ─────────────
  static async syncFromMongoDB(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const response = await fetch(DB_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'activity_logs',
          operation: 'find',
          filter: {}
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Sort newest first
        const sorted = result.data
          .map((d: any) => ({
            id: d.id || d._id?.toString(),
            clientId: d.clientId,
            clientName: d.clientName,
            action: d.action,
            performedBy: d.performedBy,
            performedByUser: d.performedByUser,
            profileImageR2Path: d.profileImageR2Path,
            timestamp: d.timestamp,
            details: d.details,
            changes: d.changes
          }))
          .sort((a: ActivityLog, b: ActivityLog) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );

        // Merge: MongoDB data + any local-only entries not yet synced
        const mongoIds = new Set(sorted.map((l: ActivityLog) => l.id));
        const localOnly = this.getLocalLogs().filter(l => !mongoIds.has(l.id));
        
        // Re-sync local-only entries to MongoDB
        for (const entry of localOnly) {
          this.saveToMongoDB(entry).catch(() => {});
        }

        const merged = [...localOnly, ...sorted];
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(this.LAST_SYNC_KEY, new Date().toISOString());
      }
    } catch {
      // Network error — keep using localStorage data
    } finally {
      this.syncInProgress = false;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  private static getLocalLogs(): ActivityLog[] {
    try {
      const logsJson = localStorage.getItem(this.STORAGE_KEY);
      return logsJson ? JSON.parse(logsJson) : [];
    } catch {
      return [];
    }
  }

  private static async saveToMongoDB(log: ActivityLog): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'activity_logs',
        operation: 'updateOne',
        filter: { id: log.id },
        update: log,
        upsert: true
      })
    });
  }

  private static async deleteOldFromMongoDB(cutoffISO: string): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'activity_logs',
        operation: 'deleteMany',
        filter: { timestamp: { $lt: cutoffISO } }
      })
    });
  }
}
