import type { CalendarEvent } from '../types/calendar';

const CALENDAR_STORAGE_KEY = 'crm_calendar_events';

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

    return updated;
  }

  deleteEvent(id: string): boolean {
    const events = this.getAllEvents();
    const filtered = events.filter(e => e.id !== id);
    if (filtered.length === events.length) return false;

    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(filtered.map(serializeEvent)));
    return true;
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    const target = date.toDateString();
    return this.getAllEvents().filter(e => e.start.toDateString() === target || e.end.toDateString() === target);
  }

  getEventsInRange(start: Date, end: Date): CalendarEvent[] {
    const startTime = start.getTime();
    const endTime = end.getTime();
    return this.getAllEvents().filter(e => e.start.getTime() <= endTime && e.end.getTime() >= startTime);
  }
}

export default new CalendarService();
