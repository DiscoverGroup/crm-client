import React, { useEffect, useMemo, useState } from 'react';
import calendarService from '../services/calendarService';
import type { CalendarEvent, CalendarAttendee } from '../types/calendar';
import { showInfoToast, showSuccessToast, showWarningToast } from '../utils/toast';

interface TeamCalendarProps {
  currentUser?: { id: string; fullName: string; username: string; email: string };
  onBack?: () => void;
}

const TeamCalendar: React.FC<TeamCalendarProps> = ({ currentUser, onBack }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [users, setUsers] = useState<Array<{ id: string; fullName: string; email: string }>>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(() => {
    return localStorage.getItem('crm_calendar_desktop_notifications') === 'true';
  });
  const [reminderSent, setReminderSent] = useState<Set<string>>(() => {
    const stored = localStorage.getItem('crm_calendar_reminders_sent');
    if (!stored) return new Set();
    try {
      return new Set(JSON.parse(stored));
    } catch {
      return new Set();
    }
  });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    location: '',
    date: '',
    startTime: '09:00',
    endTime: '10:00',
    allDay: false,
    attendeeIds: [] as string[],
    reminderMinutes: [] as number[]
  });

  useEffect(() => {
    setEvents(calendarService.getAllEvents());
    const storedUsers = localStorage.getItem('crm_users');
    if (storedUsers) {
      try {
        const parsed = JSON.parse(storedUsers);
        setUsers(parsed.map((u: any) => ({
          id: u.id,
          fullName: u.fullName || u.username,
          email: u.email
        })));
      } catch {
        setUsers([]);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('crm_calendar_reminders_sent', JSON.stringify(Array.from(reminderSent)));
  }, [reminderSent]);

  useEffect(() => {
    localStorage.setItem('crm_calendar_desktop_notifications', notificationEnabled ? 'true' : 'false');
  }, [notificationEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const upcoming = calendarService.getEventsInRange(
        new Date(now.getTime() - 60 * 1000),
        new Date(now.getTime() + 24 * 60 * 60 * 1000)
      );

      upcoming.forEach(event => {
        if (!event.reminderMinutes || event.reminderMinutes.length === 0) return;
        event.reminderMinutes.forEach(minutes => {
          const reminderTime = new Date(event.start.getTime() - minutes * 60 * 1000);
          const key = `${event.id}-${event.start.toISOString()}-${minutes}`;

          if (reminderTime <= now && now.getTime() - reminderTime.getTime() <= 60 * 1000) {
            if (!reminderSent.has(key)) {
              showInfoToast(`Reminder: ${event.title} starts in ${minutes} minutes.`);
              if (notificationEnabled && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`Upcoming: ${event.title}`, {
                  body: `${minutes} minutes remaining${event.location ? ` • ${event.location}` : ''}`,
                });
              }
              setReminderSent(prev => new Set([...Array.from(prev), key]));
            }
          }
        });
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [reminderSent]);

  const selectedDayEvents = useMemo(() => {
    return calendarService.getEventsForDate(selectedDate);
  }, [selectedDate, events]);

  const calendarDays = useMemo(() => {
    const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const startDay = start.getDay();
    const totalDays = end.getDate();

    const days: Date[] = [];
    for (let i = 0; i < startDay; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (startDay - i));
      days.push(d);
    }

    for (let day = 1; day <= totalDays; day++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));
    }

    while (days.length < 42) {
      const d = new Date(end);
      d.setDate(d.getDate() + (days.length - (startDay + totalDays) + 1));
      days.push(d);
    }

    return days;
  }, [currentMonth]);

  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const handleMoveEvent = (eventId: string, date: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const newStart = new Date(event.start);
    newStart.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    const newEnd = new Date(event.end);
    newEnd.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());

    const updated = calendarService.updateEvent(eventId, {
      start: newStart,
      end: newEnd
    });

    setEvents(prev => prev.map(e => (e.id === eventId ? updated : e)));
  };

  const handleToggleNotifications = async () => {
    if (notificationEnabled) {
      setNotificationEnabled(false);
      showInfoToast('Desktop notifications disabled.');
      return;
    }

    if (!('Notification' in window)) {
      showWarningToast('Desktop notifications are not supported in this browser.');
      return;
    }

    if (Notification.permission === 'granted') {
      setNotificationEnabled(true);
      showSuccessToast('Desktop notifications enabled.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationEnabled(true);
      showSuccessToast('Desktop notifications enabled.');
    } else {
      showWarningToast('Notification permission denied.');
    }
  };

  const handleOpenModal = () => {
    setFormData(prev => ({
      ...prev,
      date: selectedDate.toISOString().slice(0, 10)
    }));
    setShowModal(true);
  };

  const handleCreateEvent = () => {
    if (!formData.title.trim()) return;

    const date = formData.date || selectedDate.toISOString().slice(0, 10);
    const start = formData.allDay
      ? new Date(`${date}T00:00:00`)
      : new Date(`${date}T${formData.startTime}:00`);
    const end = formData.allDay
      ? new Date(`${date}T23:59:00`)
      : new Date(`${date}T${formData.endTime}:00`);

    const attendees: CalendarAttendee[] = users
      .filter(u => formData.attendeeIds.includes(u.id))
      .map(u => ({ id: u.id, name: u.fullName, email: u.email }));

    const newEvent = calendarService.createEvent({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      location: formData.location.trim() || undefined,
      start,
      end,
      allDay: formData.allDay,
      visibility: 'team',
      attendees,
      createdById: currentUser?.id,
      createdByName: currentUser?.fullName || currentUser?.username,
      color: '#3b82f6',
      reminderMinutes: formData.reminderMinutes
    });

    setEvents(prev => [...prev, newEvent]);
    setShowModal(false);
    setFormData({
      title: '',
      description: '',
      location: '',
      date: '',
      startTime: '09:00',
      endTime: '10:00',
      allDay: false,
      attendeeIds: [],
      reminderMinutes: []
    });
  };

  const handleDeleteEvent = (id: string) => {
    if (!window.confirm('Delete this event?')) return;
    const ok = calendarService.deleteEvent(id);
    if (ok) setEvents(prev => prev.filter(e => e.id !== id));
  };

  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
            >
              ← Back
            </button>
          )}
          <h1 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>📅 Team Calendar</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('month')}
              style={{
                background: viewMode === 'month' ? '#eff6ff' : 'white',
                border: 'none',
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
                color: viewMode === 'month' ? '#1d4ed8' : '#64748b'
              }}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              style={{
                background: viewMode === 'week' ? '#eff6ff' : 'white',
                border: 'none',
                padding: '8px 12px',
                cursor: 'pointer',
                fontWeight: 600,
                color: viewMode === 'week' ? '#1d4ed8' : '#64748b'
              }}
            >
              Week
            </button>
          </div>
          <button
            onClick={handleToggleNotifications}
            style={{
              background: 'white',
              color: notificationEnabled ? '#1d4ed8' : '#64748b',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px 12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="Desktop notifications"
          >
            {notificationEnabled ? '🔔 Alerts On' : '🔕 Alerts Off'}
          </button>
          <button
            onClick={handleOpenModal}
            style={{
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            + New Event
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Calendar */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button
              onClick={() => {
                if (viewMode === 'month') {
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
                } else {
                  const prevWeek = new Date(selectedDate);
                  prevWeek.setDate(prevWeek.getDate() - 7);
                  setSelectedDate(prevWeek);
                }
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ◀
            </button>
            <h2 style={{ margin: 0, fontSize: '18px' }}>
              {viewMode === 'month'
                ? monthLabel
                : `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
            </h2>
            <button
              onClick={() => {
                if (viewMode === 'month') {
                  setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
                } else {
                  const nextWeek = new Date(selectedDate);
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  setSelectedDate(nextWeek);
                }
              }}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '18px' }}
            >
              ▶
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#64748b' }}>{day}</div>
            ))}
          </div>

          {viewMode === 'month' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {calendarDays.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const dayEvents = calendarService.getEventsForDate(date);
                return (
                  <div
                    key={`${date.toISOString()}_${index}`}
                    onClick={() => setSelectedDate(date)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/plain');
                      if (id) handleMoveEvent(id, date);
                    }}
                    style={{
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : 'white',
                      borderRadius: '8px',
                      padding: '10px 6px',
                      minHeight: '80px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      opacity: isCurrentMonth ? 1 : 0.4
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600 }}>{date.getDate()}</div>
                    {dayEvents.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'grid', gap: '4px' }}>
                        {dayEvents.slice(0, 2).map(ev => (
                          <div
                            key={ev.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', ev.id)}
                            style={{
                              fontSize: '10px',
                              padding: '2px 4px',
                              borderRadius: '6px',
                              background: ev.color || '#3b82f6',
                              color: 'white',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title="Drag to move"
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span style={{ fontSize: '10px', color: '#64748b' }}>+{dayEvents.length - 2} more</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
              {weekDays.map((date) => {
                const isSelected = date.toDateString() === selectedDate.toDateString();
                const dayEvents = calendarService.getEventsForDate(date);
                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const id = e.dataTransfer.getData('text/plain');
                      if (id) handleMoveEvent(id, date);
                    }}
                    style={{
                      border: isSelected ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : 'white',
                      borderRadius: '8px',
                      padding: '8px',
                      minHeight: '120px',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                      {date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                    </div>
                    <div style={{ display: 'grid', gap: '4px' }}>
                      {dayEvents.length === 0 ? (
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>No events</div>
                      ) : (
                        dayEvents.map(ev => (
                          <div
                            key={ev.id}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', ev.id)}
                            style={{
                              fontSize: '11px',
                              padding: '4px 6px',
                              borderRadius: '6px',
                              background: ev.color || '#3b82f6',
                              color: 'white'
                            }}
                            title="Drag to move"
                          >
                            {ev.title}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Event List */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          {selectedDayEvents.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>No events for this day.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedDayEvents.map(event => (
                <div key={event.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600 }}>{event.title}</div>
                    <button
                      onClick={() => handleDeleteEvent(event.id)}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    {event.allDay ? 'All day' : `${event.start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${event.end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                  {event.location && <div style={{ fontSize: '12px', color: '#475569' }}>📍 {event.location}</div>}
                  {event.attendees.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      👥 {event.attendees.map(a => a.name).join(', ')}
                    </div>
                  )}
                  {event.reminderMinutes && event.reminderMinutes.length > 0 && (
                    <div style={{ fontSize: '12px', color: '#475569' }}>
                      ⏰ Reminders: {event.reminderMinutes.join(', ')} min
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', width: '520px', maxWidth: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Create Event</h3>
              <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: '10px' }}>
              <input
                placeholder="Event title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <textarea
                placeholder="Description (optional)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <input
                placeholder="Location (optional)"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={formData.allDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, allDay: e.target.checked }))}
                  />
                  All day
                </label>
              </div>
              {!formData.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                </div>
              )}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Invite team members</div>
                <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'grid', gap: '6px' }}>
                  {users.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>No users found</div>
                  )}
                  {users.map(u => (
                    <label key={u.id} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.attendeeIds.includes(u.id)}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            attendeeIds: e.target.checked
                              ? [...prev.attendeeIds, u.id]
                              : prev.attendeeIds.filter(id => id !== u.id)
                          }));
                        }}
                      />
                      {u.fullName}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Reminders</div>
                <div style={{ display: 'grid', gap: '6px' }}>
                  {[5, 10, 30, 60].map(minutes => (
                    <label key={minutes} style={{ display: 'flex', gap: '8px', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={formData.reminderMinutes.includes(minutes)}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            reminderMinutes: e.target.checked
                              ? [...prev.reminderMinutes, minutes]
                              : prev.reminderMinutes.filter(m => m !== minutes)
                          }));
                        }}
                      />
                      {minutes} minutes before
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white' }}>
                Cancel
              </button>
              <button onClick={handleCreateEvent} style={{ padding: '8px 12px', border: 'none', borderRadius: '8px', background: '#3b82f6', color: 'white' }}>
                Save Event
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamCalendar;
