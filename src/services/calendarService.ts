import type { CalendarEvent } from '../types/calendar';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from './realtimeSyncService';

const CALENDAR_STORAGE_KEY = 'crm_calendar_events';
const CALENDAR_SYNC_KEY = 'crm_calendar_events_last_sync';
const DB_API = '/.netlify/functions/database';

const parseEvent = (event: any): CalendarEvent => ({
  ...event,
  start: new Date(event.start),
  end: new Date(event.end),
  createdAt: new Date(event.createdAt),
  updatedAt: new Date(event.updatedAt)
});

const serializeEvent = (event: CalendarEvent) => ({
  ...event,
  start: event.start.toISOString(),
  end: event.end.toISOString(),
  createdAt: event.createdAt.toISOString(),
  updatedAt: event.updatedAt.toISOString()
});

class CalendarService {
  private syncInProgress = false;

  getAllEvents(): CalendarEvent[] {
    try {
      const data = localStorage.getItem(CALENDAR_STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map(parseEvent).sort((a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime());
    } catch {
      return [];
    }
  }

  createEvent(event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>): CalendarEvent {
    const newEvent: CalendarEvent = {
      ...event,
      id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const events = this.getAllEvents();
    events.push(newEvent);
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events.map(serializeEvent)));

    // Fire-and-forget sync to MongoDB
    this.saveEventToMongoDB(serializeEvent(newEvent)).then(() => {
      realtimeSync.signalChange('calendar_events');
    }).catch(() => {});

    return newEvent;
  }

  updateEvent(id: string, updates: Partial<CalendarEvent>): CalendarEvent {
    const events = this.getAllEvents();
    const index = events.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Event not found');

    const updated: CalendarEvent = {
      ...events[index],
      ...updates,
      id: events[index].id,
      createdAt: events[index].createdAt,
      updatedAt: new Date()
    };

    events[index] = updated;
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(events.map(serializeEvent)));

    // Fire-and-forget sync to MongoDB
    this.saveEventToMongoDB(serializeEvent(updated)).then(() => {
      realtimeSync.signalChange('calendar_events');
    }).catch(() => {});

    return updated;
  }

  deleteEvent(id: string): boolean {
    const events = this.getAllEvents();
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return false;

    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(filtered.map(serializeEvent)));

    // Fire-and-forget delete from MongoDB
    this.deleteEventFromMongoDB(id).then(() => {
      realtimeSync.signalChange('calendar_events');
    }).catch(() => {});

    return true;
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    // Use range overlap so multi-day events appear on every day they span
    return this.getAllEvents().filter(e => e.start <= endOfDay && e.end >= startOfDay);
  }

  getEventsInRange(start: Date, end: Date): CalendarEvent[] {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return this.getAllEvents().filter(e => e.start.getTime() <= endTime && e.end.getTime() >= startTime);
  }

  // ─── MongoDB Sync ─────────────────────────────────────────────────────

  async syncFromMongoDB(): Promise<void> {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const response = await fetch(DB_API, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: 'calendar_events',
          operation: 'find',
          filter: {}
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        const mongoEvents = result.data.map((d: any) => ({
          id: d.id,
          title: d.title,
          description: d.description,
          start: d.start,
          end: d.end,
          allDay: d.allDay,
          location: d.location,
          visibility: d.visibility,
          attendees: d.attendees || [],
          createdById: d.createdById,
          createdByName: d.createdByName,
          color: d.color,
          reminderMinutes: d.reminderMinutes,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        }));

        // Merge: MongoDB + local-only
        const mongoIds = new Set(mongoEvents.map((e: any) => e.id));
        const localEvents = this.getAllEvents().map(serializeEvent);
        const localOnly = localEvents.filter((e: any) => !mongoIds.has(e.id));

        // Re-sync local-only to MongoDB
        for (const evt of localOnly) {
          this.saveEventToMongoDB(evt).catch(() => {});
        }

        const merged = [...mongoEvents, ...localOnly];
        localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(merged));
        localStorage.setItem(CALENDAR_SYNC_KEY, new Date().toISOString());
      }
    } catch {
      // Network error — keep localStorage data
    } finally {
      this.syncInProgress = false;
    }
  }

  private async saveEventToMongoDB(event: any): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'calendar_events',
        operation: 'updateOne',
        filter: { id: event.id },
        update: event,
        upsert: true
      })
    });
  }

  private async deleteEventFromMongoDB(id: string): Promise<void> {
    await fetch(DB_API, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collection: 'calendar_events',
        operation: 'deleteOne',
        filter: { id }
      })
    });
  }
}

export default new CalendarService();
