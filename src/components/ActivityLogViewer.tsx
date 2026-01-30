import React, { useState, useEffect } from 'react';
import { ActivityLogService, type ActivityLog } from '../services/activityLogService';

interface ActivityLogViewerProps {
  clientId?: string;
  onBack: () => void;
}

const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({ clientId, onBack }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');

  useEffect(() => {
    loadLogs();
  }, [clientId]);

  const loadLogs = () => {
    if (clientId) {
      setLogs(ActivityLogService.getLogsByClient(clientId));
    } else {
      setLogs(ActivityLogService.getRecentLogs(100));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return '#28a745';
      case 'edited': return '#ffc107';
      case 'deleted': return '#dc3545';
      case 'recovered': return '#17a2b8';
      case 'permanently_deleted': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return '✨';
      case 'edited': return '✏️';
      case 'deleted': return '🗑️';
      case 'recovered': return '♻️';
      case 'permanently_deleted': return '⚠️';
      default: return '📝';
    }
  };

  const filteredLogs = filterAction === 'all' 
    ? logs 
    : logs.filter(log => log.action === filterAction);

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '30px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: '0 0 5px 0', color: '#0d47a1', fontSize: '28px' }}>
              📋 Activity Log
            </h1>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
              {clientId ? 'Client activity history' : 'All system activities'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '14px', fontWeight: '500', color: '#6c757d' }}>
            Filter:
          </label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{
              padding: '8px 16px',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: '14px',
              backgroundColor: '#fff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Actions</option>
            <option value="created">Created</option>
            <option value="edited">Edited</option>
            <option value="deleted">Deleted</option>
            <option value="recovered">Recovered</option>
            <option value="permanently_deleted">Permanently Deleted</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        padding: '20px'
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px',
            color: '#6c757d'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📋</div>
            <h3 style={{ margin: '0 0 10px 0' }}>No Activity Found</h3>
            <p style={{ margin: 0, opacity: 0.7 }}>
              {filterAction === 'all' ? 'No activities recorded yet' : `No ${filterAction} activities`}
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: '30px',
              top: '20px',
              bottom: '20px',
              width: '2px',
              backgroundColor: '#e9ecef'
            }} />

            {/* Activity items */}
            {filteredLogs.map((log, index) => (
              <div
                key={log.id}
                style={{
                  position: 'relative',
                  paddingLeft: '70px',
                  paddingBottom: '30px',
                  paddingTop: index === 0 ? '0' : '10px'
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: '20px',
                  top: index === 0 ? '10px' : '20px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: getActionColor(log.action),
                  border: '3px solid white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px'
                }}>
                  {getActionIcon(log.action)}
                </div>

                {/* Activity card */}
                <div style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #e9ecef',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '8px'
                  }}>
                    <div>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        backgroundColor: getActionColor(log.action),
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        marginRight: '12px'
                      }}>
                        {log.action.replace('_', ' ')}
                      </span>
                      <span style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#2c3e50'
                      }}>
                        {log.clientName}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '12px',
                      color: '#6c757d',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatDate(log.timestamp)}
                    </span>
                  </div>

                  <div style={{
                    fontSize: '13px',
                    color: '#6c757d',
                    marginBottom: '4px'
                  }}>
                    By: <strong>{log.performedByUser}</strong>
                  </div>

                  {log.details && (
                    <div style={{
                      fontSize: '13px',
                      color: '#495057',
                      marginTop: '8px',
                      fontStyle: 'italic'
                    }}>
                      {log.details}
                    </div>
                  )}

                  {log.changes && Object.keys(log.changes).length > 0 && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: '#fff',
                      borderRadius: '6px',
                      border: '1px solid #dee2e6'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#495057',
                        marginBottom: '8px'
                      }}>
                        Changes:
                      </div>
                      {Object.entries(log.changes).map(([field, change]) => (
                        <div key={field} style={{
                          fontSize: '12px',
                          color: '#6c757d',
                          marginBottom: '4px'
                        }}>
                          <strong>{field}:</strong>{' '}
                          <span style={{ color: '#dc3545', textDecoration: 'line-through' }}>
                            {String(change.old) || '(empty)'}
                          </span>
                          {' → '}
                          <span style={{ color: '#28a745', fontWeight: '500' }}>
                            {String(change.new) || '(empty)'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityLogViewer;
