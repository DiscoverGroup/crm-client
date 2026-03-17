import React, { useState, useEffect } from 'react';
import { sanitizeComment, validateLogNoteForm } from '../utils/formSanitizer';
import { LogNoteService } from '../services/logNoteService';
import { ActivityLogService, type ActivityLog } from '../services/activityLogService';
import type { LogNote } from '../types/logNote';
import MentionInput from './MentionInput';
import { NotificationService } from '../services/notificationService';
import { ClientService } from '../services/clientService';
import Loader from './Loader';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from '../services/realtimeSyncService';

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
  const [isLoading, setIsLoading] = useState(true);
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

  // Helper function to render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    const mentionRegex = /@([\w-]+)/g;
    const parts = text.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a username (captured group)
        return (
          <span
            key={index}
            style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              padding: '2px 4px',
              borderRadius: '4px',
              fontWeight: '500'
            }}
          >
            @{part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
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

  // Recursively convert reply timestamps from API data
  const restoreReplyTimestamps = (replies: any[]): any[] => {
    return (replies || []).map((reply: any) => ({
      ...reply,
      timestamp: new Date(reply.timestamp),
      replies: reply.replies ? restoreReplyTimestamps(reply.replies) : []
    }));
  };

  // Load log notes on mount and when clientId changes
  useEffect(() => {
    const loadNotes = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, {
          headers: authHeaders(),
        });
        const data = await response.json();
        
        if (data.success) {
          // Convert timestamps to Date objects
          const notes = data.logNotes.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp),
            replies: restoreReplyTimestamps(note.replies)
          }));
          setLogNotes(notes);
        } else {
          // Fallback to localStorage if API fails
          const notes = LogNoteService.getLogNotes(clientId);
          setLogNotes(notes);
        }
      } catch (error) {
        // console.error('Error fetching log notes:', error);
        // Fallback to localStorage
        const notes = LogNoteService.getLogNotes(clientId);
        setLogNotes(notes);
      } finally {
        setIsLoading(false);
      }
    };
    loadNotes();
  }, [clientId]);

  // Sync activity logs from MongoDB then read from cache
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  useEffect(() => {
    // First load from local cache immediately
    setActivityLogs(ActivityLogService.getLogsByClient(clientId));
    // Then sync from MongoDB and reload
    ActivityLogService.syncFromMongoDB().then(() => {
      setActivityLogs(ActivityLogService.getLogsByClient(clientId));
    }).catch(() => {});

    // Listen for real-time sync events
    const onActivitySync = () => {
      ActivityLogService.syncFromMongoDB().then(() => {
        setActivityLogs(ActivityLogService.getLogsByClient(clientId));
      }).catch(() => {});
    };
    const onLogNoteSync = () => {
      // Reload log notes from MongoDB
      fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, {
        headers: authHeaders(),
      }).then(r => r.json()).then(data => {
        if (data.success) {
          const notes = data.logNotes.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp),
            replies: restoreReplyTimestamps(note.replies)
          }));
          setLogNotes(notes);
        }
      }).catch(() => {});
    };
    window.addEventListener('sync:activity_logs', onActivitySync);
    window.addEventListener('sync:log_notes', onLogNoteSync);
    return () => {
      window.removeEventListener('sync:activity_logs', onActivitySync);
      window.removeEventListener('sync:log_notes', onLogNoteSync);
    };
  }, [clientId]);

  const handleAddComment = async () => {
    const cleanComment = sanitizeComment(newComment, 5000);
    const validation = validateLogNoteForm({ comment: cleanComment });
    if (!validation.valid) {
      alert(validation.firstError());
      return;
    }

    try {
      // Save to MongoDB via API
      const response = await fetch('/.netlify/functions/save-log-note', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          userId: currentUserId,
          userName: currentUserName,
          type: 'manual',
          action: 'Comment Added',
          description: cleanComment,
          status: newCommentStatus
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error('Failed to save comment');
      }

      const logNote = data.logNote;
      setLogNotes(prev => [{ ...logNote, timestamp: new Date(logNote.timestamp), replies: [] }, ...prev]);
      
      // Signal other devices about the new log note
      realtimeSync.signalChange('log_notes');
      
      // Check for mentions and create notifications
      const mentionRegex = /@([\w-]+)/g;
      const mentions = cleanComment.match(mentionRegex);
      
      if (mentions) {
        const client = ClientService.getClientById(clientId);
        const clientName = client?.contactName || 'Unknown Client';
        
        // Get all users for @everyone
        const allUsersStr = localStorage.getItem('crm_users');
        const allUsers = allUsersStr ? JSON.parse(allUsersStr) : [];
        
        mentions.forEach(mention => {
          const username = mention.substring(1); // Remove @ symbol
          
          // Check if it's @everyone
          if (username.toLowerCase() === 'everyone') {
            // Notify all users except the current user
            allUsers.forEach((user: any) => {
              if (user.id !== currentUserId) {
                NotificationService.createMentionNotification({
                  mentionedUsername: user.username,
                  fromUserId: currentUserId,
                  fromUserName: currentUserName,
                  clientId: clientId,
                  clientName: clientName,
                  logNoteId: logNote.id,
                  commentText: cleanComment
                });
              }
            });
          } else {
            // Notify specific user
            NotificationService.createMentionNotification({
              mentionedUsername: username,
              fromUserId: currentUserId,
              fromUserName: currentUserName,
              clientId: clientId,
              clientName: clientName,
              logNoteId: logNote.id,
              commentText: cleanComment
            });
          }
        });
      }
      
      setNewComment('');
      setNewCommentStatus('pending');
    } catch (error) {
      // console.error('Error adding comment:', error);
      // Fallback: Save to localStorage only
      const logNote = LogNoteService.addLogNote(
        clientId,
        currentUserId,
        currentUserName,
        'manual',
        'Comment Added',
        cleanComment,
        newCommentStatus
      );
      setLogNotes(prev => [logNote, ...prev]);
      setNewComment('');
      setNewCommentStatus('pending');
    }
  };

  const handleAddReply = (logNoteId: string) => {
    const cleanReply = sanitizeComment(replyText, 2000);
    if (!cleanReply) return;

    const reply = LogNoteService.addReply(
      logNoteId,
      clientId,
      currentUserId,
      currentUserName,
      cleanReply
    );

    if (reply) {
      // Check for mentions in reply and create notifications
      const mentionRegex = /@([\w-]+)/g;
      const mentions = cleanReply.match(mentionRegex);
      
      if (mentions) {
        const client = ClientService.getClientById(clientId);
        const clientName = client?.contactName || 'Unknown Client';
        
        // Get all users for @everyone
        const allUsersStr = localStorage.getItem('crm_users');
        const allUsers = allUsersStr ? JSON.parse(allUsersStr) : [];
        
        mentions.forEach(mention => {
          const username = mention.substring(1); // Remove @ symbol
          
          // Check if it's @everyone
          if (username.toLowerCase() === 'everyone') {
            // Notify all users except the current user
            allUsers.forEach((user: any) => {
              if (user.id !== currentUserId) {
                NotificationService.createMentionNotification({
                  mentionedUsername: user.username,
                  fromUserId: currentUserId,
                  fromUserName: currentUserName,
                  clientId: clientId,
                  clientName: clientName,
                  logNoteId: logNoteId,
                  commentText: cleanReply
                });
              }
            });
          } else {
            // Notify specific user
            NotificationService.createMentionNotification({
              mentionedUsername: username,
              fromUserId: currentUserId,
              fromUserName: currentUserName,
              clientId: clientId,
              clientName: clientName,
              logNoteId: logNoteId,
              commentText: cleanReply
            });
          }
        });
      }
      
      const notes = LogNoteService.getLogNotes(clientId);
      setLogNotes(notes);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleAddNestedReply = (logNoteId: string, parentReplyId: string) => {
    const cleanReply = sanitizeComment(replyText, 2000);
    if (!cleanReply) return;

    const reply = LogNoteService.addNestedReply(
      logNoteId,
      parentReplyId,
      clientId,
      currentUserId,
      currentUserName,
      cleanReply
    );

    if (reply) {
      const mentionRegex = /@([\w-]+)/g;
      const mentions = cleanReply.match(mentionRegex);
      
      if (mentions) {
        const client = ClientService.getClientById(clientId);
        const clientName = client?.contactName || 'Unknown Client';
        const allUsersStr = localStorage.getItem('crm_users');
        const allUsers = allUsersStr ? JSON.parse(allUsersStr) : [];
        
        mentions.forEach(mention => {
          const username = mention.substring(1);
          if (username.toLowerCase() === 'everyone') {
            allUsers.forEach((user: any) => {
              if (user.id !== currentUserId) {
                NotificationService.createMentionNotification({
                  mentionedUsername: user.username,
                  fromUserId: currentUserId,
                  fromUserName: currentUserName,
                  clientId: clientId,
                  clientName: clientName,
                  logNoteId: logNoteId,
                  commentText: cleanReply
                });
              }
            });
          } else {
            NotificationService.createMentionNotification({
              mentionedUsername: username,
              fromUserId: currentUserId,
              fromUserName: currentUserName,
              clientId: clientId,
              clientName: clientName,
              logNoteId: logNoteId,
              commentText: cleanReply
            });
          }
        });
      }
      
      const notes = LogNoteService.getLogNotes(clientId);
      setLogNotes(notes);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  const handleStatusChange = (logNoteId: string, newStatus: 'pending' | 'done' | 'on hold') => {
    // console.log('Status change called:', { logNoteId, newStatus, clientId });
    const success = LogNoteService.updateLogNoteStatus(logNoteId, clientId, newStatus);
    // console.log('Update success:', success);
    if (success) {
      const notes = LogNoteService.getLogNotes(clientId);
      // console.log('Updated notes:', notes);
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
      height: 'fit-content',
      width: '100%',
      minWidth: 0
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
              // Blur the textarea to close mention dropdown
              if (document.activeElement instanceof HTMLTextAreaElement) {
                document.activeElement.blur();
              }
            }}
            onFocus={() => {
              // Ensure mention dropdown closes when status gets focus
              if (document.activeElement instanceof HTMLTextAreaElement) {
                document.activeElement.blur();
              }
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
              zIndex: 1
            }}
          >
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="on hold">On Hold</option>
          </select>
        </div>
        
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
            <MentionInput
              value={newComment}
              onChange={setNewComment}
              placeholder="Add comment... (Type @ to mention someone)"
            />
          </div>
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
        {isLoading ? (
          <Loader message="Loading activity logs..." />
        ) : (
          <>
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
              <div style={{ flex: 1, minWidth: 0 }}>
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
                    color: '#64748b',
                    whiteSpace: 'nowrap',
                    marginLeft: '8px'
                  }}>
                    {formatTimestamp(new Date(log.timestamp))}
                  </span>
                </div>
                <p style={{
                  fontSize: '12px',
                  color: '#475569',
                  margin: '4px 0',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}>
                  {log.details}
                </p>
                {/* Field-level change diff */}
                {log.changes && Object.keys(log.changes).length > 0 && (
                  <div style={{
                    marginTop: '6px',
                    padding: '6px 8px',
                    background: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {Object.entries(log.changes).map(([field, change]: [string, any]) => (
                      <div key={field} style={{ fontSize: '11px', lineHeight: '1.6' }}>
                        <span style={{ fontWeight: 600, color: '#0369a1' }}>{field}:</span>{' '}
                        <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>
                          &ldquo;{String(change.old) || '(empty)'}&rdquo;
                        </span>
                        <span style={{ color: '#64748b', margin: '0 4px' }}>→</span>
                        <span style={{ color: '#16a34a', fontWeight: 500 }}>
                          &ldquo;{String(change.new) || '(empty)'}&rdquo;
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  by {log.performedByUser}
                </div>
                
                {/* Action Buttons for Activity Logs */}
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
                      setReplyingTo(replyingTo === log.id ? null : log.id);
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

                {/* Reply Form for Activity Logs */}
                {replyingTo === log.id && (
                  <div 
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: '8px',
                      padding: '8px',
                      background: 'white',
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
                        <MentionInput
                          value={replyText}
                          onChange={setReplyText}
                          placeholder="Write a reply... (Type @ to mention someone)"
                          style={{
                            width: '100%'
                          }}
                        />
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '6px',
                          marginTop: '6px'
                        }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(null);
                              setReplyText('');
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              border: '1px solid #e2e8f0',
                              background: 'white',
                              color: '#64748b',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!replyText.trim()) return;
                              
                              // Create a new log note as a reply to the activity log
                              const logNote = LogNoteService.addLogNote(
                                clientId,
                                currentUserId,
                                currentUserName,
                                'manual',
                                `Reply to ${log.action.replace('_', ' ')}`,
                                replyText,
                                'pending',
                                undefined,
                                undefined,
                                undefined,
                                log.id
                              );
                              
                              // Check for mentions
                              const mentionRegex = /@([\w-]+)/g;
                              const mentions = replyText.match(mentionRegex);
                              
                              if (mentions) {
                                const client = ClientService.getClientById(clientId);
                                const clientName = client?.contactName || 'Unknown Client';
                                const allUsersStr = localStorage.getItem('crm_users');
                                const allUsers = allUsersStr ? JSON.parse(allUsersStr) : [];
                                
                                mentions.forEach(mention => {
                                  const username = mention.substring(1);
                                  
                                  if (username.toLowerCase() === 'everyone') {
                                    allUsers.forEach((user: any) => {
                                      if (user.id !== currentUserId) {
                                        NotificationService.createMentionNotification({
                                          mentionedUsername: user.username,
                                          fromUserId: currentUserId,
                                          fromUserName: currentUserName,
                                          clientId: clientId,
                                          clientName: clientName,
                                          logNoteId: logNote.id,
                                          commentText: replyText
                                        });
                                      }
                                    });
                                  } else {
                                    NotificationService.createMentionNotification({
                                      mentionedUsername: username,
                                      fromUserId: currentUserId,
                                      fromUserName: currentUserName,
                                      clientId: clientId,
                                      clientName: clientName,
                                      logNoteId: logNote.id,
                                      commentText: replyText
                                    });
                                  }
                                });
                              }
                              
                              setLogNotes(prev => [logNote, ...prev]);
                              setReplyText('');
                              setReplyingTo(null);
                            }}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              border: 'none',
                              background: '#3b82f6',
                              color: 'white',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Replies to this activity log (from log notes with parentActivityLogId) */}
                {logNotes.filter(n => n.parentActivityLogId === log.id).length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    paddingLeft: '12px',
                    borderLeft: '2px solid #e2e8f0'
                  }}>
                    {logNotes.filter(n => n.parentActivityLogId === log.id).map((replyNote) => (
                      <div key={replyNote.id}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '6px',
                          marginBottom: '4px',
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
                            fontWeight: '600',
                            flexShrink: 0
                          }}>
                            {getInitials(replyNote.userName)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginBottom: '2px'
                            }}>
                              <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '11px' }}>
                                {replyNote.userName}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '10px' }}>
                                {formatTimestamp(replyNote.timestamp)}
                              </span>
                            </div>
                            <div style={{ color: '#475569', fontSize: '11px', lineHeight: '1.3', wordBreak: 'break-word' }}>
                              {renderTextWithMentions(replyNote.description)}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setReplyingTo(replyingTo === replyNote.id ? null : replyNote.id);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                fontSize: '10px',
                                cursor: 'pointer',
                                padding: '2px 0',
                                marginTop: '2px'
                              }}
                            >
                              💬 Reply
                            </button>

                            {/* Reply form for this activity log reply */}
                            {replyingTo === replyNote.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  marginTop: '6px',
                                  padding: '6px',
                                  background: 'white',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                  <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#3b82f6',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '8px',
                                    fontWeight: '600'
                                  }}>
                                    {getInitials(currentUserName)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <MentionInput
                                      value={replyText}
                                      onChange={setReplyText}
                                      placeholder={`Reply to ${replyNote.userName}...`}
                                      style={{ width: '100%' }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); }}
                                        style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}
                                      >Cancel</button>
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleAddReply(replyNote.id); }}
                                        disabled={!replyText.trim()}
                                        style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: replyText.trim() ? 'pointer' : 'not-allowed', opacity: replyText.trim() ? 1 : 0.5 }}
                                      >Reply</button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Nested LogReply threads under this activity log reply */}
                        {replyNote.replies && replyNote.replies.length > 0 && (
                          <div style={{
                            paddingLeft: '16px',
                            borderLeft: '2px solid #e2e8f0',
                            marginLeft: '10px',
                            marginBottom: '4px'
                          }}>
                            {(() => {
                              const renderActivityReplies = (replies: import('../types/logNote').LogReply[], depth: number): React.ReactNode => {
                                return replies.map((reply) => (
                                  <div key={reply.id}>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '6px',
                                      marginBottom: '4px',
                                      padding: '6px',
                                      background: depth % 2 === 0 ? '#f8fafc' : '#f1f5f9',
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
                                        fontWeight: '600',
                                        flexShrink: 0
                                      }}>
                                        {getInitials(reply.userName)}
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                                          <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '11px' }}>{reply.userName}</span>
                                          <span style={{ color: '#64748b', fontSize: '10px' }}>{formatTimestamp(reply.timestamp)}</span>
                                        </div>
                                        <div style={{ color: '#475569', fontSize: '11px', lineHeight: '1.3', wordBreak: 'break-word' }}>
                                          {renderTextWithMentions(reply.message)}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReplyingTo(replyingTo === reply.id ? null : reply.id); }}
                                          style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '10px', cursor: 'pointer', padding: '2px 0', marginTop: '2px' }}
                                        >💬 Reply</button>

                                        {replyingTo === reply.id && (
                                          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '6px', padding: '6px', background: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600' }}>
                                                {getInitials(currentUserName)}
                                              </div>
                                              <div style={{ flex: 1 }}>
                                                <MentionInput value={replyText} onChange={setReplyText} placeholder={`Reply to ${reply.userName}...`} style={{ width: '100%' }} />
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); }} style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleAddNestedReply(replyNote.id, reply.id); }} disabled={!replyText.trim()} style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: replyText.trim() ? 'pointer' : 'not-allowed', opacity: replyText.trim() ? 1 : 0.5 }}>Reply</button>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {reply.replies && reply.replies.length > 0 && (
                                      <div style={{ paddingLeft: '16px', borderLeft: '2px solid #e2e8f0', marginLeft: '10px', marginBottom: '4px' }}>
                                        {renderActivityReplies(reply.replies, depth + 1)}
                                      </div>
                                    )}
                                  </div>
                                ));
                              };
                              return renderActivityReplies(replyNote.replies, 0);
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Manual Logs */}
        {logNotes.filter(n => !n.parentActivityLogId).length === 0 && activityLogs.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '24px 16px',
            color: '#64748b',
            fontSize: '13px'
          }}>
            No activity yet. Changes to this client will appear here automatically.
          </div>
        ) : (
          logNotes.filter(n => !n.parentActivityLogId).map((note) => (
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
                          {renderTextWithMentions(note.description.split('\n').slice(1).join('\n'))}
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
                            {renderTextWithMentions(note.description)}
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
                    // console.log('Dropdown changed to:', e.target.value);
                    handleStatusChange(note.id, e.target.value as 'pending' | 'done' | 'on hold');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    // console.log('Dropdown clicked for note:', note.id);
                  }}
                  onFocus={() => {
                    // console.log('Dropdown focused for note:', note.id);
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
                    zIndex: 1,
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
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
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
                      <MentionInput
                        value={replyText}
                        onChange={setReplyText}
                        placeholder="Write a reply... (Type @ to mention someone)"
                        style={{
                          width: '100%'
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

              {/* Replies (recursive/threaded) */}
              {note.replies && note.replies.length > 0 && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: '8px',
                    paddingLeft: '12px',
                    borderLeft: '2px solid #e2e8f0'
                  }}
                >
                  {(() => {
                    const renderReplies = (replies: import('../types/logNote').LogReply[], depth: number): React.ReactNode => {
                      return replies.map((reply) => (
                        <div key={reply.id}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '6px',
                            marginBottom: '4px',
                            padding: '6px',
                            background: depth % 2 === 0 ? '#f8fafc' : '#f1f5f9',
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
                              fontWeight: '600',
                              flexShrink: 0
                            }}>
                              {getInitials(reply.userName)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
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
                                lineHeight: '1.3',
                                wordBreak: 'break-word'
                              }}>
                                {renderTextWithMentions(reply.message)}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setReplyingTo(replyingTo === reply.id ? null : reply.id);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#94a3b8',
                                  fontSize: '10px',
                                  cursor: 'pointer',
                                  padding: '2px 0',
                                  marginTop: '2px'
                                }}
                              >
                                💬 Reply
                              </button>

                              {/* Nested reply form */}
                              {replyingTo === reply.id && (
                                <div style={{
                                  marginTop: '6px',
                                  padding: '6px',
                                  background: 'white',
                                  borderRadius: '4px',
                                  border: '1px solid #e2e8f0'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                    <div style={{
                                      width: '18px',
                                      height: '18px',
                                      borderRadius: '50%',
                                      background: '#3b82f6',
                                      color: 'white',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '8px',
                                      fontWeight: '600'
                                    }}>
                                      {getInitials(currentUserName)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <MentionInput
                                        value={replyText}
                                        onChange={setReplyText}
                                        placeholder={`Reply to ${reply.userName}...`}
                                        style={{ width: '100%' }}
                                      />
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); }}
                                          style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}
                                        >Cancel</button>
                                        <button
                                          type="button"
                                          onClick={(e) => { e.stopPropagation(); handleAddNestedReply(note.id, reply.id); }}
                                          disabled={!replyText.trim()}
                                          style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: replyText.trim() ? 'pointer' : 'not-allowed', opacity: replyText.trim() ? 1 : 0.5 }}
                                        >Reply</button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Render nested replies recursively */}
                          {reply.replies && reply.replies.length > 0 && (
                            <div style={{
                              paddingLeft: '16px',
                              borderLeft: '2px solid #e2e8f0',
                              marginLeft: '10px',
                              marginBottom: '4px'
                            }}>
                              {renderReplies(reply.replies, depth + 1)}
                            </div>
                          )}
                        </div>
                      ));
                    };
                    return renderReplies(note.replies, 0);
                  })()}
                </div>
              )}
            </div>
          ))
        )}
        </>
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

            {/* Replies (threaded) */}
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
                  gap: '8px'
                }}>
                  {(() => {
                    const renderModalReplies = (replies: import('../types/logNote').LogReply[], depth: number): React.ReactNode => {
                      return replies.map((reply) => (
                        <div key={reply.id}>
                          <div style={{
                            backgroundColor: depth % 2 === 0 ? '#f9fafb' : '#f1f5f9',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid #e5e7eb',
                            marginLeft: depth > 0 ? 20 : 0
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
                              {renderTextWithMentions(reply.message)}
                            </div>
                          </div>
                          {reply.replies && reply.replies.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              {renderModalReplies(reply.replies, depth + 1)}
                            </div>
                          )}
                        </div>
                      ));
                    };
                    return renderModalReplies(selectedNote.replies, 0);
                  })()}
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