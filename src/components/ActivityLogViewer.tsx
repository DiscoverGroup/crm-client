import React, { useState, useEffect } from 'react';
import { ActivityLogService, type ActivityLog } from '../services/activityLogService';

interface ActivityLogViewerProps {
  clientId?: string;
  onBack: () => void;
}

const ActivityLogViewer: React.FC<ActivityLogViewerProps> = ({ clientId, onBack }) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [sortOrder, setSortOrder] = useState<'recent' | 'oldest' | 'active'>('recent');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<'specific' | 'range'>('specific');
  const [specificDate, setSpecificDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

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
      case 'file_uploaded': return '#007bff';
      case 'file_deleted': return '#fd7e14';
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
      case 'file_uploaded': return '📎';
      case 'file_deleted': return '🗑️';
      default: return '📝';
    }
  };

  // Apply all filters
  const filteredLogs = logs.filter(log => {
    // Action filter
    if (filterAction !== 'all' && log.action !== filterAction) {
      return false;
    }

    // Date filter
    if (specificDate || (startDate && endDate)) {
      const logDate = new Date(log.timestamp);
      
      if (dateFilterType === 'specific' && specificDate) {
        const filterDate = new Date(specificDate);
        const logDateOnly = new Date(logDate.getFullYear(), logDate.getMonth(), logDate.getDate());
        const filterDateOnly = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate());
        if (logDateOnly.getTime() !== filterDateOnly.getTime()) {
          return false;
        }
      } else if (dateFilterType === 'range' && startDate && endDate) {
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        if (logDate < startDateTime || logDate > endDateTime) {
          return false;
        }
      }
    }

    return true;
  });

  // Apply sorting
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime();
    const dateB = new Date(b.timestamp).getTime();
    
    if (sortOrder === 'recent') {
      return dateB - dateA; // Newest first
    } else if (sortOrder === 'oldest') {
      return dateA - dateB; // Oldest first
    } else {
      // Most active - group by client and show most frequently updated
      return dateB - dateA;
    }
  });

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
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#6c757d' }}>
              Sort:
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                padding: '8px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="active">Most active</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: '500', color: '#6c757d' }}>
              Action:
            </label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              style={{
                padding: '8px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '14px',
         sort backgroundColor: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="edited">Edited</option>
              <option value="deleted">Deleted</option>
              <option value="recovered">Recovered</option>
              <option value="permanently_deleted">Permanently Deleted</option>
              <option value="file_uploaded">File Uploaded</option>
              <option value="file_deleted">File Deleted</option>
            </select>
          </div>

          <button
            onClick={() => setShowDateFilter(!showDateFilter)}
            style={{
              padding: '8px 16px',
              backgroundColor: showDateFilter ? '#0d47a1' : '#fff',
              color: showDateFilter ? '#fff' : '#0d47a1',
              border: '2px solid #0d47a1',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📅 Date Filter
          </button>

          {(specificDate || startDate || endDate) && (
            <button
              onClick={() => {
                setSpecificDate('');
                setStartDate('');
                setEndDate('');
                setStartTime('00:00');
                setEndTime('23:59');
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Date Filter Panel */}
      {showDateFilter && (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          padding: '20px',
          marginBottom: '20px'
        }}>
          <h3 style={{ margin: '0 0 16px 0', color: '#0d47a1', fontSize: '18px' }}>
            📅 Date & Time Filter
          </h3>

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="specific"
                checked={dateFilterType === 'specific'}
                onChange={(e) => setDateFilterType(e.target.value as any)}
              />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Specific Date</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="range"
                checked={dateFilterType === 'range'}
                onChange={(e) => setDateFilterType(e.target.value as any)}
              />
              <span style={{ fontSize: '14px', fontWeight: '500' }}>Date Range</span>
            </label>
          </div>

          {dateFilterType === 'specific' ? (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: '#6c757d' }}>
                Select Date:
              </label>
              <input
                type="date"
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#6c757d', marginBottom: '8px' }}>
                  Start Date & Time:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#6c757d', marginBottom: '8px' }}>
                  End Date & Time:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
            {sortedLogs.map((log, index) => (
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
                <div 
                onClick={() => setSelectedLog(log)}
                style={{
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px',
                  padding: '16px',
                  border: '1px solid #e9ecef',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#fff';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
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

      {/* Detail Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}
        onClick={() => setSelectedLog(null)}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '700px',
              width: '90%',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              animation: 'modalSlideIn 0.3s ease-out'
            }}>
            <style>
              {`
                @keyframes modalSlideIn {
                  from {
                    opacity: 0;
                    transform: translateY(-20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
              `}
            </style>

            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: '24px',
              paddingBottom: '16px',
              borderBottom: '2px solid #e9ecef'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '32px'
                  }}>
                    {getActionIcon(selectedLog.action)}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 16px',
                    backgroundColor: getActionColor(selectedLog.action),
                    color: 'white',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}>
                    {selectedLog.action.replace('_', ' ')}
                  </span>
                </div>
                <h2 style={{
                  margin: '8px 0 4px 0',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#1f2937'
                }}>
                  {selectedLog.clientName}
                </h2>
                <p style={{
                  margin: 0,
                  fontSize: '14px',
                  color: '#6b7280'
                }}>
                  {formatDate(selectedLog.timestamp)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                style={{
                  background: '#f3f4f6',
                  border: 'none',
                  borderRadius: '8px',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: '#6b7280',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#e5e7eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#f3f4f6';
                }}
              >
                ✕
              </button>
            </div>

            {/* Details */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Performed By
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1f2937' }}>
                    {selectedLog.performedByUser}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                    Log ID
                  </div>
                  <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#1f2937' }}>
                    {selectedLog.id}
                  </div>
                </div>
              </div>
            </div>

            {selectedLog.details && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '8px'
                }}>
                  Details
                </div>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#4b5563',
                  lineHeight: '1.6'
                }}>
                  {selectedLog.details}
                </div>
              </div>
            )}

            {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  Changes Made
                </div>
                <div style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  {Object.entries(selectedLog.changes).map(([field, change]) => (
                    <div key={field} style={{
                      padding: '12px',
                      backgroundColor: 'white',
                      borderRadius: '6px',
                      marginBottom: '8px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#6b7280',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {field}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                            Previous
                          </div>
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#fee2e2',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#991b1b',
                            wordBreak: 'break-word'
                          }}>
                            {String(change.old) || '(empty)'}
                          </div>
                        </div>
                        <div style={{ fontSize: '20px', color: '#9ca3af' }}>→</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                            Updated
                          </div>
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#d1fae5',
                            borderRadius: '6px',
                            fontSize: '13px',
                            color: '#065f46',
                            fontWeight: '500',
                            wordBreak: 'break-word'
                          }}>
                            {String(change.new) || '(empty)'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLogViewer;
