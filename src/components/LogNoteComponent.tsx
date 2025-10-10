import React, { useState, useEffect } from 'react';
import { LogNoteService } from '../services/logNoteService';
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

  // Load log notes
  useEffect(() => {
    const notes = LogNoteService.getLogNotes(clientId);
    
    // Add some sample log notes for testing if none exist
    if (notes.length === 0 && clientId && clientId !== '') {
      // Add a sample log note to test the dropdown
      LogNoteService.addLogNote(
        clientId,
        currentUserId,
        currentUserName,
        'manual',
        'Sample Comment',
        'This is a sample comment to test the status dropdown functionality.',
        'pending'
      );
      
      LogNoteService.addLogNote(
        clientId,
        currentUserId,
        currentUserName,
        'auto',
        'Status Update',
        'Automatically generated status update.',
        'done'
      );
      
      // Reload notes after adding samples
      const updatedNotes = LogNoteService.getLogNotes(clientId);
      setLogNotes(updatedNotes);
    } else {
      setLogNotes(notes);
    }
  }, [clientId, currentUserId, currentUserName]);

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

      {/* Comments Header */}
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
            Comments
          </span>
          <span style={{
            background: '#f97316',
            color: 'white',
            borderRadius: '10px',
            padding: '2px 6px',
            fontSize: '11px',
            fontWeight: '500'
          }}>
            {logNotes.length}
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
        {logNotes.length === 0 ? (
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
            <div key={note.id} style={{
              background: 'white',
              borderRadius: '8px',
              padding: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
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
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Dropdown changed to:', e.target.value);
                    handleStatusChange(note.id, e.target.value as 'pending' | 'done' | 'on hold');
                  }}
                  onClick={(e) => {
                    e.preventDefault();
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
                <div style={{
                  marginTop: '8px',
                  paddingLeft: '12px',
                  borderLeft: '2px solid #e2e8f0'
                }}>
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
    </div>
  );
};

export default LogNoteComponent;