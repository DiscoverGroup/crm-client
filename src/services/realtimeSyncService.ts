/**
 * RealtimeSyncService
 *
 * Provides near-instant cross-device data synchronisation.
 *
 * How it works:
 *  1. Every write operation calls `signalChange(collection)` which updates
 *     a tiny `sync_metadata` document in MongoDB with the current timestamp.
 *  2. A lightweight poller (`startPolling`) checks that document every 5 s.
 *  3. When a timestamp for a collection is newer than our last-seen value,
 *     we dispatch a window event (`sync:<collection>`) so components can
 *     re-fetch only the data that changed.
 *  4. BroadcastChannel gives instant cross-tab sync in the same browser.
 */

import { authHeaders } from '../utils/authToken';

// ── Types ────────────────────────────────────────────────────────────────────

type SyncCollection =
  | 'activity_logs'
  | 'file_attachments'
  | 'calendar_events'
  | 'notifications'
  | 'clients'
  | 'log_notes';

interface SyncTimestamps {
  [key: string]: string; // ISO timestamp per collection
}

// ── Class ────────────────────────────────────────────────────────────────────

class RealtimeSyncService {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private lastSeen: SyncTimestamps = {};
  private broadcastChannel: BroadcastChannel | null = null;
  private isPolling = false;
  private POLL_MS = 5000; // 5-second poll

  // ─── Start polling (call once after login) ─────────────────────────────

  start(): void {
    if (this.pollInterval) return; // already running

    // Initialise BroadcastChannel for same-browser cross-tab sync
    try {
      this.broadcastChannel = new BroadcastChannel('crm_sync');
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'sync' && event.data?.collection) {
          this.dispatchSyncEvent(event.data.collection);
        }
      };
    } catch {
      // BroadcastChannel not supported — cross-tab will still work via polling
    }

    // Do an initial fetch so we have baseline timestamps (no sync events fired)
    this.fetchTimestamps(true).catch(() => {});

    // Start the recurring poll
    this.pollInterval = setInterval(() => {
      this.fetchTimestamps(false).catch(() => {});
    }, this.POLL_MS);
  }

  // ─── Stop polling (call on logout) ────────────────────────────────────

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
    this.lastSeen = {};
  }

  // ─── Signal that a collection was modified (call after every write) ───

  async signalChange(collection: SyncCollection): Promise<void> {
    // Notify other tabs instantly via BroadcastChannel
    try {
      this.broadcastChannel?.postMessage({ type: 'sync', collection });
    } catch { /* ignore */ }

    // Tell MongoDB so other devices pick it up on their next poll.
    // Use the SERVER's timestamp as lastSeen so our own poll never
    // re-triggers due to client/server clock skew.
    try {
      const res = await fetch('/.netlify/functions/sync-signal', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.timestamp) {
          this.lastSeen[collection] = data.timestamp;
        }
      }
    } catch {
      // Non-critical — other devices will eventually sync anyway
    }

    // Fallback: if signal failed, set a far-future sentinel so the next
    // poll cycle won't self-trigger
    if (!this.lastSeen[collection]) {
      this.lastSeen[collection] = new Date(Date.now() + 30000).toISOString();
    }
  }

  // ─── Private: poll MongoDB for timestamp changes ──────────────────────

  private async fetchTimestamps(isInitial: boolean): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const response = await fetch('/.netlify/functions/sync-check', {
        headers: authHeaders(),
      });

      if (!response.ok) return;
      const result = await response.json();
      if (!result.success) return;

      const timestamps: SyncTimestamps = result.timestamps || {};

      if (isInitial) {
        // First fetch — just record baselines, don't fire events
        this.lastSeen = { ...timestamps };
        return;
      }

      // Compare each collection — fire events for anything newer
      const collections: SyncCollection[] = [
        'activity_logs',
        'file_attachments',
        'calendar_events',
        'notifications',
        'clients',
        'log_notes'
      ];

      for (const col of collections) {
        const remote = timestamps[col];
        const local = this.lastSeen[col];
        if (remote && remote !== local) {
          this.lastSeen[col] = remote;
          this.dispatchSyncEvent(col);
        }
      }
    } catch {
      // Network error — skip this cycle
    } finally {
      this.isPolling = false;
    }
  }

  // ─── Dispatch a window event that components listen to ────────────────

  private dispatchSyncEvent(collection: string): void {
    window.dispatchEvent(new CustomEvent('realtimeSync', { detail: { collection } }));
    // Also dispatch collection-specific event for convenience
    window.dispatchEvent(new Event(`sync:${collection}`));
  }
}

// Export a singleton
export const realtimeSync = new RealtimeSyncService();
