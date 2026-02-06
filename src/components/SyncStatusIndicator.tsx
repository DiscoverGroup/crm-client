import React, { useState, useEffect } from 'react';

type SyncStatus = 'online' | 'syncing' | 'offline' | 'error';

interface SyncStatusIndicatorProps {
  style?: React.CSSProperties;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ style }) => {
  const [status, setStatus] = useState<SyncStatus>('online');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  useEffect(() => {
    // Listen for sync events
    const handleSyncStart = () => setStatus('syncing');
    const handleSyncSuccess = () => {
      setStatus('online');
      setLastSyncTime(new Date().toLocaleTimeString());
    };
    const handleSyncError = () => setStatus('error');
    const handleOffline = () => setStatus('offline');
    const handleOnline = () => setStatus('online');

    window.addEventListener('syncStart', handleSyncStart);
    window.addEventListener('syncSuccess', handleSyncSuccess);
    window.addEventListener('syncError', handleSyncError);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // Check initial online status
    if (!navigator.onLine) {
      setStatus('offline');
    }

    return () => {
      window.removeEventListener('syncStart', handleSyncStart);
      window.removeEventListener('syncSuccess', handleSyncSuccess);
      window.removeEventListener('syncError', handleSyncError);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          icon: '🟢',
          text: 'Synced',
          color: '#28a745',
          tooltip: lastSyncTime ? `Last synced at ${lastSyncTime}` : 'Connected to database'
        };
      case 'syncing':
        return {
          icon: '🟡',
          text: 'Syncing...',
          color: '#ffc107',
          tooltip: 'Syncing data with database'
        };
      case 'offline':
        return {
          icon: '🔴',
          text: 'Offline',
          color: '#dc3545',
          tooltip: 'Working offline - changes saved locally'
        };
      case 'error':
        return {
          icon: '⚠️',
          text: 'Error',
          color: '#ff6b6b',
          tooltip: 'Sync error - will retry automatically'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        fontSize: '13px',
        fontWeight: '500',
        color: '#fff',
        cursor: 'help',
        transition: 'all 0.3s ease',
        ...style
      }}
      title={config.tooltip}
    >
      <span style={{ fontSize: '12px' }}>{config.icon}</span>
      <span>{config.text}</span>
    </div>
  );
};

export default SyncStatusIndicator;
