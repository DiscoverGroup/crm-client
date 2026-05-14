import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NotificationService } from '../services/notificationService';
import type { Notification } from '../types/notification';
import ToastNotification from './ToastNotification';

// ── Notification sound via Web Audio API ─────────────────────────────────────
// AudioContext stays unlocked after first user gesture — works from any callback
let _audioCtx: AudioContext | null = null;
let _audioBuffer: AudioBuffer | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) {
        console.error('[SOUND] AudioContext not supported in this browser');
        return null;
      }
      _audioCtx = new Ctor();
      console.log('[SOUND] AudioContext created, state:', _audioCtx.state);
    }
    return _audioCtx;
  } catch (e) {
    console.error('[SOUND] Failed to create AudioContext:', e);
    return null;
  }
}

async function loadSoundBuffer(): Promise<void> {
  if (_audioBuffer) {
    console.log('[SOUND] Buffer already loaded, skipping fetch');
    return;
  }
  const ctx = getAudioCtx();
  if (!ctx) { console.error('[SOUND] loadSoundBuffer: no AudioContext'); return; }
  try {
    console.log('[SOUND] Fetching /sounds/notification.mp3 ...');
    const res = await fetch('/sounds/notification.mp3');
    if (!res.ok) {
      console.error('[SOUND] Fetch failed:', res.status, res.statusText);
      return;
    }
    const buf = await res.arrayBuffer();
    console.log('[SOUND] Fetched', buf.byteLength, 'bytes, decoding...');
    _audioBuffer = await ctx.decodeAudioData(buf);
    console.log('[SOUND] Buffer decoded OK, duration:', _audioBuffer.duration.toFixed(2), 's');
  } catch (e) {
    console.error('[SOUND] loadSoundBuffer error:', e);
  }
}

// Unlock AudioContext and pre-load sound on first user interaction
function unlockAndLoad(): void {
  console.log('[SOUND] unlockAndLoad triggered');
  const ctx = getAudioCtx();
  if (!ctx) { console.error('[SOUND] unlockAndLoad: no AudioContext'); return; }
  console.log('[SOUND] AudioContext state before resume:', ctx.state);
  if (ctx.state === 'suspended') {
    ctx.resume()
      .then(() => { console.log('[SOUND] AudioContext resumed OK'); return loadSoundBuffer(); })
      .catch((e) => console.error('[SOUND] resume failed:', e));
  } else {
    loadSoundBuffer().catch((e) => console.error('[SOUND] loadSoundBuffer failed:', e));
  }
}
document.addEventListener('click', unlockAndLoad, { once: true });
document.addEventListener('keydown', unlockAndLoad, { once: true });

function playNotificationSound(): void {
  console.log('[SOUND] playNotificationSound called');
  const ctx = getAudioCtx();
  if (!ctx) { console.error('[SOUND] play: no AudioContext'); return; }
  if (!_audioBuffer) { console.error('[SOUND] play: buffer not loaded yet — was unlockAndLoad called?'); return; }
  console.log('[SOUND] AudioContext state at play time:', ctx.state);
  try {
    if (ctx.state === 'suspended') {
      console.warn('[SOUND] Context suspended at play time — resuming first');
      ctx.resume().catch((e) => console.error('[SOUND] resume at play time failed:', e));
    }
    const src = ctx.createBufferSource();
    src.buffer = _audioBuffer;
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.6;
    src.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(0);
    console.log('[SOUND] BufferSource started OK');
  } catch (e) {
    console.error('[SOUND] play error:', e);
  }
}

interface NotificationDropdownProps {
  currentUser: { fullName: string; username: string };
  onNavigate: (page: 'client-form' | 'activity-log' | 'log-notes', params?: any) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ currentUser, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // -1 = not yet initialized (skip toast on first load)
  const previousCountRef = useRef<number>(-1);

  // Load notifications
  const loadNotifications = useCallback(() => {
    const userNotifs = NotificationService.getUserNotifications(currentUser.fullName);
    const newUnreadCount = NotificationService.getUnreadCount(currentUser.fullName);
    
    // Only trigger toast+sound for genuinely new notifications (not on first load)
    if (previousCountRef.current !== -1 && newUnreadCount > previousCountRef.current && userNotifs.length > 0) {
      console.log('[NOTIF] New notification detected — prev:', previousCountRef.current, '→ now:', newUnreadCount);
      const latestUnread = userNotifs.find(n => !n.isRead);
      if (latestUnread) {
        setToastNotification(latestUnread);
        playNotificationSound();
      } else {
        console.warn('[NOTIF] No unread notification found despite count increase');
      }
    } else if (previousCountRef.current === -1) {
      console.log('[NOTIF] Initial load — skipping toast. Unread count:', newUnreadCount);
    }
    
    previousCountRef.current = newUnreadCount;
    setNotifications(userNotifs);
    setUnreadCount(newUnreadCount);
  }, [currentUser.fullName]);

  useEffect(() => {
    // Sync from MongoDB first, record baseline (no toast), then start polling
    NotificationService.syncFromMongoDB(currentUser.fullName).then(() => {
      loadNotifications();
    }).catch(() => {
      loadNotifications();
    });
    
    // Poll every 8 seconds as a fallback for when the realtimeSync fast path
    // (sync-signal → 5s poller → sync:notifications event) fails due to a
    // cold-start Lambda or transient network error.
    const interval = setInterval(() => {
      NotificationService.syncFromMongoDB(currentUser.fullName).then(() => {
        loadNotifications();
      }).catch(() => {});
    }, 8000);

    // Also listen for realtimeSync / BroadcastChannel events.
    // Show from localStorage immediately (covers same-browser BroadcastChannel
    // which is instant), then fire a background MongoDB sync so cross-device
    // data is fetched too.
    let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onSync = () => {
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      // Step 1: render from localStorage immediately (zero latency same-browser path)
      loadNotifications();
      // Step 2: debounced MongoDB fetch for cross-device path
      syncDebounceTimer = setTimeout(() => {
        NotificationService.syncFromMongoDB(currentUser.fullName).then(() => {
          loadNotifications();
        }).catch(() => {});
      }, 500);
    };
    window.addEventListener('sync:notifications', onSync);
    return () => {
      clearInterval(interval);
      if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
      window.removeEventListener('sync:notifications', onSync);
    };
  }, [currentUser.fullName, loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    NotificationService.markAsRead(notification.id);
    loadNotifications();
    setIsOpen(false);

    // Navigate to the relevant page
    if (notification.link) {
      onNavigate(notification.link.page, {
        clientId: notification.link.clientId,
        noteId: notification.link.noteId,
        scrollTo: notification.link.scrollTo
      });
    }
  };

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead(currentUser.fullName);
    loadNotifications();
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'mention': return '💬';
      case 'comment': return '💭';
      case 'status_change': return '🔄';
      case 'file_upload': return '📎';
      case 'client_update': return '📝';
      case 'new_sale': return '🎉';
      case 'new_bc': return '📄';
      default: return '🔔';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const displayedNotifications = showAll ? notifications : notifications.slice(0, 10);

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Notification Bell Icon */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        style={{
          position: 'relative',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          transition: 'background-color 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <span style={{ fontSize: '24px' }}>🔔</span>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            backgroundColor: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '600',
            border: '2px solid white'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          right: 0,
          width: '380px',
          maxHeight: '500px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          border: '1px solid #e5e7eb',
          zIndex: 10000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>
              Notifications
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#3b82f6',
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: '400px'
          }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#6c757d'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }}>🔔</div>
                <p style={{ margin: 0, fontSize: '14px' }}>No notifications yet</p>
              </div>
            ) : (
              <>
                {displayedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      backgroundColor: notification.isRead ? 'white' : '#eff6ff',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = notification.isRead ? '#f9fafb' : '#dbeafe';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = notification.isRead ? 'white' : '#eff6ff';
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ fontSize: '24px', flexShrink: 0 }}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: notification.isRead ? '400' : '600',
                          color: '#1e293b',
                          marginBottom: '4px'
                        }}>
                          {notification.title}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b',
                          lineHeight: '1.4',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical'
                        }}>
                          {notification.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span>{formatTimestamp(notification.timestamp)}</span>
                          {notification.clientName && (
                            <>
                              <span>•</span>
                              <span>{notification.clientName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {!notification.isRead && (
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          flexShrink: 0,
                          marginTop: '6px'
                        }} />
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Show More Button */}
                {!showAll && notifications.length > 10 && (
                  <button
                    onClick={() => setShowAll(true)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      backgroundColor: 'white',
                      color: '#3b82f6',
                      fontSize: '13px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      borderTop: '1px solid #f1f5f9'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  >
                    Show {notifications.length - 10} more
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      <ToastNotification 
        notification={toastNotification}
        onClose={() => setToastNotification(null)}
      />
    </div>
  );
};

export default NotificationDropdown;
