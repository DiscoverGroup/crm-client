export type CalendarVisibility = 'team' | 'private';

export interface CalendarAttendee {
  id: string;
  name: string;
  email?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  location?: string;
  visibility: CalendarVisibility;
  attendees: CalendarAttendee[];
  createdById?: string;
  createdByName?: string;
  color?: string;
  reminderMinutes?: number[];
  createdAt: Date;
  updatedAt: Date;
}
