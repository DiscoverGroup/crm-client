import React, { useEffect, useState } from 'react';
import type { Notification } from '../types/notification';

interface ToastNotificationProps {
  notification: Notification | null;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ notification, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

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

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 10000,
        transform: isVisible ? 'translateX(0)' : 'translateX(400px)',
        opacity: isVisible ? 1 : 0,
        transition: 'all 0.3s ease-in-out',
        maxWidth: '400px',
        minWidth: '320px'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          color: 'white',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
      >
        <div
          style={{
            fontSize: '24px',
            flexShrink: 0
          }}
        >
          {getNotificationIcon(notification.type)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: '14px',
              fontWeight: '600',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span>New Notification</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
                setTimeout(onClose, 300);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '12px',
                padding: 0
              }}
            >
              ✕
            </button>
          </div>
          <div
            style={{
              fontSize: '13px',
              opacity: 0.95,
              lineHeight: '1.4',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical'
            }}
          >
            {notification.message}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastNotification;
