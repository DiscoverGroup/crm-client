import React, { useState, useEffect, useRef } from 'react';
import { NotificationService } from '../services/notificationService';
import type { Notification } from '../types/notification';
import ToastNotification from './ToastNotification';

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
  const previousCountRef = useRef<number>(0);

  // Load notifications
  const loadNotifications = () => {
    const userNotifs = NotificationService.getUserNotifications(currentUser.fullName);
    const newUnreadCount = NotificationService.getUnreadCount(currentUser.fullName);
    
    // Check if there's a new notification
    if (newUnreadCount > previousCountRef.current && userNotifs.length > 0) {
      // Show toast for the most recent unread notification
      const latestUnread = userNotifs.find(n => !n.isRead);
      if (latestUnread) {
        setToastNotification(latestUnread);
      }
    }
    
    previousCountRef.current = newUnreadCount;
    setNotifications(userNotifs);
    setUnreadCount(newUnreadCount);
  };

  useEffect(() => {
    loadNotifications();
    
    // Refresh notifications every 10 seconds
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [currentUser.fullName]);

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
