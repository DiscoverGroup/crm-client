import React, { useState, useEffect } from 'react';
import { LogNoteService } from '../services/logNoteService';
import { ActivityLogService, type ActivityLog } from '../services/activityLogService';
import type { LogNote } from '../types/logNote';

interface LogNoteComponentProps {
  clientId: string;
  currentUserId: string;
  currentUserName: string;
}

const LogNoteComponent: React.FC<LogNoteComponentProps> = ({ 
  clientId, 
  currentUserId, 
  currentUserName 
}) => {
  const [logNotes, setLogNotes] = useState<LogNote[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newCommentStatus, setNewCommentStatus] = useState<'pending' | 'done' | 'on hold'>('pending');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [selectedNote, setSelectedNote] = useState<LogNote | null>(null);

  // Helper function to get user initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Helper function to format timestamp like "Today at 6:06 PM"
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `Today at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    } else if (diffInHours < 48) {
      return `Yesterday at ${date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      })}`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    }
  };

  // Load log notes on mount and when clientId changes
  useEffect(() => {
    const loadNotes = () => {
      const notes = LogNoteService.getLogNotes(clientId);
      console.log('Loading notes for client:', clientId, notes);
      setLogNotes(notes);
    };
    loadNotes();
  }, [clientId]);

  // Get activity logs for this client
  const activityLogs = ActivityLogService.getLogsByClient(clientId);

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    const logNote = LogNoteService.addLogNote(
      clientId,
      currentUserId,
      currentUserName,
      'manual',
      'Comment Added',
      newComment,
      newCommentStatus
    );

    setLogNotes(prev => [logNote, ...prev]);
    setNewComment('');
    setNewCommentStatus('pending');
  };

  const handleAddReply = (logNoteId: string) => {
    if (!replyText.trim()) return;

    const reply = LogNoteService.addReply(
      logNoteId,
      clientId,
      currentUserId,
      currentUserName,
      replyText
    );

    if (reply) {
      const notes = LogNoteService.getLogNotes(clientId);
      setLogNotes(notes);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleStatusChange = (logNoteId: string, newStatus: 'pending' | 'done' | 'on hold') => {
    console.log('Status change called:', { logNoteId, newStatus, clientId });
    const success = LogNoteService.updateLogNoteStatus(logNoteId, clientId, newStatus);
    console.log('Update success:', success);
    if (success) {
      const notes = LogNoteService.getLogNotes(clientId);
      console.log('Updated notes:', notes);
      setLogNotes(notes);
    }
  };

  const getStatusStyles = (status: 'pending' | 'done' | 'on hold') => {
    switch (status) {
      case 'done':
        return { background: '#dcfce7', color: '#16a34a' };
      case 'on hold':
        return { background: '#fef2f2', color: '#dc2626' };
      default: // pending
        return { background: '#fef3c7', color: '#d97706' };
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.9) 100%)',
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 8px 32px rgba(59, 130, 246, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)',
      border: '1px solid rgba(147, 197, 253, 0.3)',
      height: 'fit-content'
    }}>
      <h3 style={{
        margin: '0 0 16px 0',
        color: '#1e293b',
        fontSize: '1.25rem',
        fontWeight: '600'
      }}>
        Activity Log
      </h3>

      {/* Add Comment Section */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '12px',
        marginBottom: '16px',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#3b82f6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '600'
          }}>
            {getInitials(currentUserName)}
          </div>
          <div style={{ flex: 1 }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add comment..."
              style={{
                width: '100%',
                minHeight: '60px',
                padding: '8px',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '13px',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </div>
        
        {/* Status dropdown for new comment */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px'
        }}>
          <label style={{
            fontSize: '12px',
            fontWeight: '500',
            color: '#374151'
          }}>
            Status:
          </label>
          <select
            value={newCommentStatus}
            onChange={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setNewCommentStatus(e.target.value as 'pending' | 'done' | 'on hold');
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              padding: '4px 8px',
              border: '1px solid #e2e8f0',
              borderRadius: '4px',
              fontSize: '12px',
              background: 'white',
              outline: 'none',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 1000
            }}
          >
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="on hold">On Hold</option>
          </select>
        </div>
        
        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddComment();
            }}
            disabled={!newComment.trim()}
            style={{
              background: '#f97316',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: newComment.trim() ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500',
              opacity: newComment.trim() ? 1 : 0.5
            }}
          >
            Submit
          </button>
        </div>
      </div>

      {/* Logs Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#1e293b'
          }}>
            Logs
          </span>
          <span style={{
            background: '#f97316',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: '500'
          }}>
            {logNotes.length + activityLogs.length}
          </span>
        </div>
        
        <select
          style={{
            padding: '3px 6px',
            border: '1px solid #e2e8f0',
            borderRadius: '4px',
            fontSize: '12px',
            background: 'white'
          }}
        >
          <option>Most recent</option>
          <option>Oldest first</option>
          <option>Most active</option>
        </select>
      </div>

      {/* Log Notes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Activity Logs (automatic) */}
        {activityLogs.map((log) => (
          <div 
            key={log.id} 
            onClick={() => setSelectedLog(log)}
            style={{
              background: '#f8fafc',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderLeft: '3px solid #3b82f6',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.transform = 'translateX(4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.transform = 'translateX(0)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <div style={{
                fontSize: '18px',
                marginTop: '2px'
              }}>
                {log.action === 'created' && '✨'}
                {log.action === 'edited' && '✏️'}
                {log.action === 'deleted' && '🗑️'}
                {log.action === 'recovered' && '♻️'}
                {log.action === 'permanently_deleted' && '⚠️'}
                {log.action === 'file_uploaded' && '📎'}
                {log.action === 'file_deleted' && '🗑️'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#1e293b',
                    textTransform: 'capitalize'
                  }}>
                    {log.action.replace('_', ' ')}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: '#64748b'
                  }}>
                    {formatTimestamp(new Date(log.timestamp))}
                  </span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: '#475569',
                  margin: '4px 0',
                  lineHeight: '1.4'
                }}>
                  {log.details}
                </p>
                <div style={{
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  by {log.performedByUser}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Manual Logs */}
        {logNotes.length === 0 && activityLogs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            color: '#64748b',
            fontSize: '13px'
          }}>
            No activity yet. Changes to this client will appear here automatically.
          </div>
        ) : (
          logNotes.map((note) => (
            <div 
              key={note.id} 
              onClick={() => setSelectedNote(note)}
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Note Header with User Info and Timestamp */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                marginBottom: '8px'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: '#3b82f6',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {getInitials(note.userName)}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* User name and timestamp */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '3px'
                  }}>
                    <span style={{
                      fontWeight: '600',
                      color: '#1e293b',
                      fontSize: '13px'
                    }}>
                      {note.userName}
                    </span>
                    <span style={{
                      color: '#64748b',
                      fontSize: '11px'
                    }}>
                      {formatTimestamp(note.timestamp)}
                    </span>
                  </div>
                  
                  {/* Action description */}
                  <div style={{
                    color: '#475569',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    wordBreak: 'break-word'
                  }}>
                    {note.type === 'auto' && note.action.includes('Section Updated') ? (
                      <div>
                        <div style={{
                          fontWeight: '500',
                          color: '#1e293b',
                          marginBottom: '3px'
                        }}>
                          {note.action.replace('Section Updated: ', '')}
                        </div>
                        <div style={{
                          color: '#64748b',
                          fontSize: '11px',
                          whiteSpace: 'pre-line'
                        }}>
                          {note.description.split('\n').slice(1).join('\n')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <span style={{ fontWeight: '500' }}>
                          {note.action}
                        </span>
                        {note.description && (
                          <div style={{
                            marginTop: '3px',
                            color: '#64748b',
                            fontSize: '11px'
                          }}>
                            {note.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Status dropdown */}
                <select
                  value={note.status}
                  onChange={(e) => {
                    e.stopPropagation();
                    console.log('Dropdown changed to:', e.target.value);
                    handleStatusChange(note.id, e.target.value as 'pending' | 'done' | 'on hold');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Dropdown clicked for note:', note.id);
                  }}
                  onFocus={() => {
                    console.log('Dropdown focused for note:', note.id);
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '500',
                    border: '1px solid transparent',
                    outline: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    zIndex: 1000,
                    ...getStatusStyles(note.status)
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="on hold">On Hold</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginTop: '6px',
                paddingTop: '6px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setReplyingTo(replyingTo === note.id ? null : note.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  💬 Reply
                </button>
              </div>

              {/* Reply Form */}
              {replyingTo === note.id && (
                <div style={{
                  marginTop: '8px',
                  padding: '8px',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px'
                  }}>
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: '600'
                    }}>
                      {getInitials(currentUserName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Write a reply..."
                        style={{
                          width: '100%',
                          minHeight: '50px',
                          padding: '6px',
                          border: '1px solid #e2e8f0',
                          borderRadius: '4px',
                          fontSize: '12px',
                          resize: 'vertical',
                          outline: 'none'
                        }}
                      />
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '6px',
                        marginTop: '6px'
                      }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setReplyingTo(null);
                            setReplyText('');
                          }}
                          style={{
                            background: 'none',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleAddReply(note.id);
                          }}
                          disabled={!replyText.trim()}
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                            opacity: replyText.trim() ? 1 : 0.5
                          }}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Replies */}
              {note.replies && note.replies.length > 0 && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '8px',
                    paddingLeft: '12px',
                    borderLeft: '2px solid #e2e8f0'
                  }}
                >
                  {note.replies.map((reply) => (
                    <div key={reply.id} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '6px',
                      marginBottom: '8px',
                      padding: '6px',
                      background: '#f8fafc',
                      borderRadius: '4px'
                    }}>
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#6b7280',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '9px',
                        fontWeight: '600'
                      }}>
                        {getInitials(reply.userName)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          marginBottom: '2px'
                        }}>
                          <span style={{
                            fontWeight: '600',
                            color: '#1e293b',
                            fontSize: '11px'
                          }}>
                            {reply.userName}
                          </span>
                          <span style={{
                            color: '#64748b',
                            fontSize: '10px'
                          }}>
                            {formatTimestamp(reply.timestamp)}
                          </span>
                        </div>
                        <div style={{
                          color: '#475569',
                          fontSize: '11px',
                          lineHeight: '1.3'
                        }}>
                          {reply.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Detail Modal for Activity Logs */}
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
                  <span style={{ fontSize: '32px' }}>
                    {selectedLog.action === 'created' && '✨'}
                    {selectedLog.action === 'edited' && '✏️'}
                    {selectedLog.action === 'deleted' && '🗑️'}
                    {selectedLog.action === 'recovered' && '♻️'}
                    {selectedLog.action === 'permanently_deleted' && '⚠️'}
                    {selectedLog.action === 'file_uploaded' && '📎'}
                    {selectedLog.action === 'file_deleted' && '🗑️'}
                  </span>
                  <span style={{
                    display: 'inline-block',
                    padding: '6px 16px',
                    backgroundColor: selectedLog.action === 'created' ? '#10b981' : 
                                   selectedLog.action === 'edited' ? '#3b82f6' :
                                   selectedLog.action === 'deleted' ? '#ef4444' :
                                   selectedLog.action === 'file_uploaded' ? '#8b5cf6' : '#6b7280',
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
                  {formatTimestamp(new Date(selectedLog.timestamp))}
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

      {/* Detail Modal for Manual Notes */}
      {selectedNote && (
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
        onClick={() => setSelectedNote(null)}
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
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: '600'
                  }}>
                    {getInitials(selectedNote.userName)}
                  </div>
                  <div>
                    <h2 style={{
                      margin: '0 0 4px 0',
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#1f2937'
                    }}>
                      {selectedNote.userName}
                    </h2>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      {formatTimestamp(selectedNote.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
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

            {/* Content */}
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px'
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '8px'
              }}>
                {selectedNote.action}
              </div>
              {selectedNote.description && (
                <div style={{
                  fontSize: '14px',
                  color: '#4b5563',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-line'
                }}>
                  {selectedNote.description}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '20px'
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1f2937'
              }}>
                Status:
              </span>
              <span style={{
                padding: '6px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: selectedNote.status === 'done' ? '#d1fae5' : 
                               selectedNote.status === 'on hold' ? '#fed7aa' : '#dbeafe',
                color: selectedNote.status === 'done' ? '#065f46' : 
                       selectedNote.status === 'on hold' ? '#9a3412' : '#1e40af'
              }}>
                {selectedNote.status.toUpperCase()}
              </span>
            </div>

            {/* Replies */}
            {selectedNote.replies && selectedNote.replies.length > 0 && (
              <div>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '12px'
                }}>
                  Replies ({selectedNote.replies.length})
                </div>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  {selectedNote.replies.map((reply) => (
                    <div key={reply.id} style={{
                      backgroundColor: '#f9fafb',
                      borderRadius: '8px',
                      padding: '12px',
                      border: '1px solid #e5e7eb'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#6b7280',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {getInitials(reply.userName)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            {reply.userName}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: '#6b7280'
                          }}>
                            {formatTimestamp(reply.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div style={{
                        fontSize: '13px',
                        color: '#4b5563',
                        lineHeight: '1.5'
                      }}>
                        {reply.message}
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

export default LogNoteComponent;