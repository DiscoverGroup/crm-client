import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { sanitizeComment, validateLogNoteForm } from '../utils/formSanitizer';
import { LogNoteService } from '../services/logNoteService';
import { ActivityLogService, type ActivityLog } from '../services/activityLogService';
import type { LogNote, LogNoteAttachment } from '../types/logNote';
import MentionInput from './MentionInput';
import { NotificationService } from '../services/notificationService';
import { ClientService } from '../services/clientService';
import { FileService } from '../services/fileService';
import R2DownloadButton from './R2DownloadButton';
import Loader from './Loader';
import { authHeaders } from '../utils/authToken';
import { realtimeSync } from '../services/realtimeSyncService';

interface LogNoteComponentProps {
  clientId: string;
  currentUserId: string;
  currentUserName: string;
}

// Fetches a signed URL from R2 and renders an inline image
const R2InlineImage: React.FC<{ r2Path: string; name: string; onOpen: (src: string) => void; large?: boolean }> = ({ r2Path, name, onOpen, large }) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/.netlify/functions/download-file?path=${encodeURIComponent(r2Path)}`, {
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then(data => { if (!cancelled && data.success && data.url) setSignedUrl(data.url); else if (!cancelled) setFailed(true); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [r2Path]);

  if (failed) return null;
  if (!signedUrl) return <div style={{ width: large ? '100%' : 120, height: large ? 200 : 80, borderRadius: 6, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#94a3b8' }}>Loading…</div>;
  return (
    <img
      src={signedUrl}
      alt={name}
      style={large
        ? { width: '100%', maxHeight: 320, borderRadius: 8, cursor: 'zoom-in', objectFit: 'contain', border: '1px solid #e2e8f0', display: 'block', background: '#f8fafc' }
        : { maxWidth: 220, maxHeight: 160, borderRadius: 6, cursor: 'zoom-in', objectFit: 'contain', border: '1px solid #e2e8f0', display: 'block' }}
      onClick={(e) => { e.stopPropagation(); onOpen(signedUrl); }}
      onError={() => setFailed(true)}
    />
  );
};

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
  const [commentFiles, setCommentFiles] = useState<File[]>([]);
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Helper function to get user initials
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Decode HTML entities that may have been encoded by old sanitizer
  const decodeHtml = (text: string | undefined): string => {
    if (!text) return text ?? '';
    return text
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/→/g, '→')
      .replace(/•/g, '•');
  };

  // Helper function to render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    text = decodeHtml(text);
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
          const mongoNotes = data.logNotes.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp),
            statusChangedAt: note.statusChangedAt ? new Date(note.statusChangedAt) : undefined,
            replies: restoreReplyTimestamps(note.replies)
          }));

          // Merge any pending localStorage notes that failed to save to MongoDB
          const localNotes = LogNoteService.getLogNotes(clientId);
          const mongoIds = new Set(mongoNotes.map((n: any) => n.id));
          const pendingLocal = localNotes.filter((n: any) => !mongoIds.has(n.id));

          if (pendingLocal.length > 0) {
            // Try to sync pending localStorage notes to MongoDB
            for (const note of pendingLocal) {
              try {
                await fetch('/.netlify/functions/save-log-note', {
                  method: 'POST',
                  headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    clientId: note.clientId,
                    userId: note.userId,
                    userName: note.userName,
                    type: note.type,
                    action: note.action,
                    description: note.description,
                    status: note.status,
                    attachments: note.attachments || []
                  })
                });
              } catch {
                // Will retry on next load
              }
            }
            // Remove synced notes from localStorage
            LogNoteService.clearLogNotes(clientId);
            // Reload from MongoDB to get canonical data
            const refreshResponse = await fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, {
              headers: authHeaders(),
            });
            const refreshData = await refreshResponse.json();
            if (refreshData.success) {
              const refreshedNotes = refreshData.logNotes.map((note: any) => ({
                ...note,
                timestamp: new Date(note.timestamp),
                statusChangedAt: note.statusChangedAt ? new Date(note.statusChangedAt) : undefined,
                replies: restoreReplyTimestamps(note.replies)
              }));
              setLogNotes(refreshedNotes);
            } else {
              setLogNotes(mongoNotes);
            }
          } else {
            setLogNotes(mongoNotes);
          }
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

  // Upload files to R2 and return attachment metadata
  const uploadAttachments = async (files: File[]): Promise<LogNoteAttachment[]> => {
    const results: LogNoteAttachment[] = [];
    for (const file of files) {
      const stored = await FileService.fileToStoredFile(file, 'log-notes');
      results.push({
        id: stored.id,
        name: stored.name,
        type: stored.type,
        size: stored.size,
        r2Path: stored.r2Path || '',
        url: stored.data,
        uploadDate: stored.uploadDate,
      });
    }
    return results;
  };

  // Render attachment chips/images in a note or reply
  const renderAttachments = (attachments: LogNoteAttachment[] | undefined, large = false) => {
    if (!attachments || attachments.length === 0) return null;
    return (
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {attachments.map(att => {
          const isImg = att.type.startsWith('image/');
          return (
            <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {isImg && att.r2Path && (
                <R2InlineImage r2Path={att.r2Path} name={att.name} onOpen={setLightboxSrc} large={large} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {!isImg && <span style={{ fontSize: 14 }}>📄</span>}
                <span style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{att.name}</span>
                {att.r2Path && <R2DownloadButton r2Path={att.r2Path} className="" style={{ fontSize: 10, padding: '2px 6px' }} />}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const handleAddComment = async () => {
    const cleanComment = sanitizeComment(newComment, 5000);
    const validation = validateLogNoteForm({ comment: cleanComment });
    if (!validation.valid) {
      alert(validation.firstError());
      return;
    }

    setIsUploading(true);
    let attachments: LogNoteAttachment[] = [];
    try { attachments = await uploadAttachments(commentFiles); } catch {}

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
          status: newCommentStatus,
          attachments
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
      // Fallback: Save to localStorage and merge on next load
      const logNote = LogNoteService.addLogNote(
        clientId,
        currentUserId,
        currentUserName,
        'manual',
        'Comment Added',
        cleanComment,
        newCommentStatus
      );
      (logNote as any)._pendingSync = true;
      setLogNotes(prev => [logNote, ...prev]);
      setNewComment('');
      setNewCommentStatus('pending');
    }
    setCommentFiles([]);
    setIsUploading(false);
  };

  const handleAddReply = async (logNoteId: string) => {
    const cleanReply = sanitizeComment(replyText, 2000);
    if (!cleanReply) return;

    setIsUploading(true);
    let attachments: LogNoteAttachment[] = [];
    try { attachments = await uploadAttachments(replyFiles); } catch {}

    try {
      // Save reply to MongoDB via API
      const response = await fetch('/.netlify/functions/add-log-reply', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logNoteId,
          userId: currentUserId,
          userName: currentUserName,
          message: cleanReply,
          attachments
        })
      });
      const data = await response.json();

      if (data.success) {
        // Check for mentions in reply and create notifications
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
                    mentionedUsername: user.username, fromUserId: currentUserId, fromUserName: currentUserName,
                    clientId, clientName, logNoteId, commentText: cleanReply
                  });
                }
              });
            } else {
              NotificationService.createMentionNotification({
                mentionedUsername: username, fromUserId: currentUserId, fromUserName: currentUserName,
                clientId, clientName, logNoteId, commentText: cleanReply
              });
            }
          });
        }

        // Refresh log notes from MongoDB
        const notesResp = await fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, {
          headers: authHeaders(),
        });
        const notesData = await notesResp.json();
        if (notesData.success) {
          const notes = notesData.logNotes.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp),
            replies: restoreReplyTimestamps(note.replies)
          }));
          setLogNotes(notes);
        }
        realtimeSync.signalChange('log_notes');
      } else {
        throw new Error('API failed');
      }
    } catch {
      // Fallback to localStorage
      const reply = LogNoteService.addReply(logNoteId, clientId, currentUserId, currentUserName, cleanReply);
      if (reply) {
        const notes = LogNoteService.getLogNotes(clientId);
        setLogNotes(notes);
      }
    }
    setReplyFiles([]);
    setIsUploading(false);
    setReplyText('');
    setReplyingTo(null);
  };

  const handleAddNestedReply = async (logNoteId: string, parentReplyId: string) => {
    const cleanReply = sanitizeComment(replyText, 2000);
    if (!cleanReply) return;

    setIsUploading(true);
    let attachments: LogNoteAttachment[] = [];
    try { attachments = await uploadAttachments(replyFiles); } catch {}

    try {
      // Save nested reply to MongoDB via API
      const response = await fetch('/.netlify/functions/add-log-reply', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logNoteId,
          userId: currentUserId,
          userName: currentUserName,
          message: cleanReply,
          parentReplyId,
          attachments
        })
      });
      const data = await response.json();

      if (data.success) {
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
                    mentionedUsername: user.username, fromUserId: currentUserId, fromUserName: currentUserName,
                    clientId, clientName, logNoteId, commentText: cleanReply
                  });
                }
              });
            } else {
              NotificationService.createMentionNotification({
                mentionedUsername: username, fromUserId: currentUserId, fromUserName: currentUserName,
                clientId, clientName, logNoteId, commentText: cleanReply
              });
            }
          });
        }

        // Refresh log notes from MongoDB
        const notesResp = await fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, {
          headers: authHeaders(),
        });
        const notesData = await notesResp.json();
        if (notesData.success) {
          const notes = notesData.logNotes.map((note: any) => ({
            ...note,
            timestamp: new Date(note.timestamp),
            replies: restoreReplyTimestamps(note.replies)
          }));
          setLogNotes(notes);
        }
        realtimeSync.signalChange('log_notes');
      } else {
        throw new Error('API failed');
      }
    } catch {
      // Fallback to localStorage
      const reply = LogNoteService.addNestedReply(logNoteId, parentReplyId, clientId, currentUserId, currentUserName, cleanReply);
      if (reply) {
        const notes = LogNoteService.getLogNotes(clientId);
        setLogNotes(notes);
      }
    }
    setReplyFiles([]);
    setIsUploading(false);
    setReplyText('');
    setReplyingTo(null);
  };

  const handleStatusChange = (logNoteId: string, newStatus: 'pending' | 'done' | 'on hold') => {
    const changedAt = new Date();
    const changedBy = currentUserName?.trim() || 'Unknown';

    // Optimistically update UI immediately
    setLogNotes(prev => prev.map(n =>
      n.id === logNoteId
        ? { ...n, status: newStatus, statusChangedAt: changedAt, statusChangedBy: changedBy }
        : n
    ));

    // Persist to MongoDB
    fetch('/.netlify/functions/update-log-note-status', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ logNoteId, status: newStatus, changedBy, changedAt: changedAt.toISOString() })
    }).then(async res => {
      if (!res.ok) {
        // Revert on failure — re-fetch from server to get real state
        const refreshRes = await fetch(`/.netlify/functions/get-log-notes?clientId=${clientId}`, { headers: authHeaders() });
        const data = await refreshRes.json();
        if (data.success) {
          setLogNotes(data.logNotes.map((n: any) => ({
            ...n,
            timestamp: new Date(n.timestamp),
            statusChangedAt: n.statusChangedAt ? new Date(n.statusChangedAt) : undefined
          })));
        }
      }
    }).catch(() => {});
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
            className="log-status-select"
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

        {/* File attachment for comment */}
        <div style={{ marginTop: '6px' }}>
          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', border: '1px dashed #cbd5e1', borderRadius: '4px', fontSize: '11px', color: '#64748b' }}>
            <input
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setCommentFiles(prev => [...prev, ...files]);
                e.target.value = '';
              }}
            />
            📎 Attach file or image
          </label>
          {commentFiles.length > 0 && (
            <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {commentFiles.map((file, idx) => {
                const isImg = file.type.startsWith('image/');
                const previewUrl = isImg ? URL.createObjectURL(file) : null;
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', background: '#f1f5f9', borderRadius: '4px', fontSize: '11px' }}>
                    {isImg && previewUrl
                      ? <img src={previewUrl} alt={file.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '3px' }} />
                      : <span>📄</span>}
                    <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <button type="button" onClick={() => setCommentFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px', padding: 0 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Submit button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleAddComment();
            }}
            disabled={!newComment.trim() || isUploading}
            style={{
              background: '#f97316',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: (newComment.trim() && !isUploading) ? 'pointer' : 'not-allowed',
              fontSize: '12px',
              fontWeight: '500',
              opacity: (newComment.trim() && !isUploading) ? 1 : 0.5
            }}
          >
            {isUploading ? 'Uploading…' : 'Submit'}
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
                          style={{ width: '100%' }}
                        />
                        {/* File attach for reply */}
                        <div style={{ marginTop: '4px' }}>
                          <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', border: '1px dashed #cbd5e1', borderRadius: '4px', fontSize: '10px', color: '#64748b' }}>
                            <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={(e) => { setReplyFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                            📎 Attach
                          </label>
                          {replyFiles.length > 0 && (
                            <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {replyFiles.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px', background: '#f1f5f9', borderRadius: '3px', fontSize: '10px' }}>
                                  {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: '2px' }} /> : <span>📄</span>}
                                  <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                  <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: 0 }}>✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); setReplyFiles([]); }}
                            style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!replyText.trim()) return;
                              const cleanReply = sanitizeComment(replyText, 2000);
                              if (!cleanReply) return;

                              setIsUploading(true);
                              let attachments: LogNoteAttachment[] = [];
                              try { attachments = await uploadAttachments(replyFiles); } catch {}

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
                                    action: `Reply to ${log.action.replace('_', ' ')}`,
                                    description: cleanReply,
                                    status: 'pending',
                                    parentActivityLogId: log.id,
                                    attachments
                                  })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  const logNote = { ...data.logNote, timestamp: new Date(data.logNote.timestamp), replies: [] };
                                  // Check for mentions
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
                                              mentionedUsername: user.username, fromUserId: currentUserId, fromUserName: currentUserName,
                                              clientId, clientName, logNoteId: logNote.id, commentText: cleanReply
                                            });
                                          }
                                        });
                                      } else {
                                        NotificationService.createMentionNotification({
                                          mentionedUsername: username, fromUserId: currentUserId, fromUserName: currentUserName,
                                          clientId, clientName, logNoteId: logNote.id, commentText: cleanReply
                                        });
                                      }
                                    });
                                  }
                                  setLogNotes(prev => [logNote, ...prev]);
                                  realtimeSync.signalChange('log_notes');
                                } else {
                                  throw new Error('API failed');
                                }
                              } catch {
                                // Fallback to localStorage
                                const logNote = LogNoteService.addLogNote(clientId, currentUserId, currentUserName, 'manual',
                                  `Reply to ${log.action.replace('_', ' ')}`, cleanReply, 'pending', undefined, undefined, undefined, log.id);
                                setLogNotes(prev => [logNote, ...prev]);
                              }
                              setReplyFiles([]);
                              setIsUploading(false);
                              setReplyText('');
                              setReplyingTo(null);
                            }}
                            disabled={isUploading}
                            style={{ padding: '4px 10px', fontSize: '11px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '4px', cursor: isUploading ? 'wait' : 'pointer', opacity: isUploading ? 0.6 : 1 }}
                          >
                            {isUploading ? 'Uploading…' : 'Reply'}
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
                            {renderAttachments(replyNote.attachments)}
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
                                style={{ marginTop: '6px', padding: '6px', background: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                              >
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600' }}>
                                    {getInitials(currentUserName)}
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <MentionInput value={replyText} onChange={setReplyText} placeholder={`Reply to ${replyNote.userName}...`} style={{ width: '100%' }} />
                                    <div style={{ marginTop: '4px' }}>
                                      <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '2px 6px', border: '1px dashed #cbd5e1', borderRadius: '3px', fontSize: '10px', color: '#64748b' }}>
                                        <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={(e) => { setReplyFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                                        📎 Attach
                                      </label>
                                      {replyFiles.length > 0 && (
                                        <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                                          {replyFiles.map((f, i) => (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px', background: '#f1f5f9', borderRadius: '3px', fontSize: '9px' }}>
                                              {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 20, height: 20, objectFit: 'cover', borderRadius: '2px' }} /> : <span>📄</span>}
                                              <span style={{ maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                              <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '10px', padding: 0 }}>✕</button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); setReplyFiles([]); }} style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                                      <button type="button" onClick={(e) => { e.stopPropagation(); handleAddReply(replyNote.id); }} disabled={!replyText.trim() || isUploading} style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: (replyText.trim() && !isUploading) ? 'pointer' : 'not-allowed', opacity: (replyText.trim() && !isUploading) ? 1 : 0.5 }}>{isUploading ? '…' : 'Reply'}</button>
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
                                        {renderAttachments((reply as any).attachments)}
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
                                                <div style={{ marginTop: '3px' }}>
                                                  <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px', border: '1px dashed #cbd5e1', borderRadius: '3px', fontSize: '9px', color: '#64748b' }}>
                                                    <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={(e) => { setReplyFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                                                    📎 Attach
                                                  </label>
                                                  {replyFiles.length > 0 && (
                                                    <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                                      {replyFiles.map((f, i) => (
                                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 4px', background: '#f1f5f9', borderRadius: '2px', fontSize: '9px' }}>
                                                          {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: '2px' }} /> : <span>📄</span>}
                                                          <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                          <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '9px', padding: 0 }}>✕</button>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  )}
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); setReplyFiles([]); }} style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                                                  <button type="button" onClick={(e) => { e.stopPropagation(); handleAddNestedReply(replyNote.id, reply.id); }} disabled={!replyText.trim() || isUploading} style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: (replyText.trim() && !isUploading) ? 'pointer' : 'not-allowed', opacity: (replyText.trim() && !isUploading) ? 1 : 0.5 }}>{isUploading ? '…' : 'Reply'}</button>
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
                  
                  {/* Action description — organized by type */}
                  <div style={{ color: '#475569', fontSize: '12px', lineHeight: '1.4', wordBreak: 'break-word' }}>

                    {/* ── Field Changed ── */}
                    {note.type === 'auto' && note.action === 'Field Updated' && note.fieldChanged ? (
                      <div>
                        <span style={{
                          display: 'inline-block',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          marginBottom: '6px'
                        }}>✏️ Field Changed</span>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          fontSize: '11px'
                        }}>
                          <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '5px' }}>
                            {decodeHtml(note.fieldChanged)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{
                              background: '#fee2e2', color: '#991b1b',
                              padding: '2px 8px', borderRadius: '4px',
                              textDecoration: 'line-through', fontSize: '11px'
                            }}>
                              {decodeHtml(note.oldValue) || '(empty)'}
                            </span>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>
                            <span style={{
                              background: '#dcfce7', color: '#166534',
                              padding: '2px 8px', borderRadius: '4px',
                              fontWeight: 600, fontSize: '11px'
                            }}>
                              {decodeHtml(note.newValue) || '(empty)'}
                            </span>
                          </div>
                        </div>
                      </div>

                    /* ── File Uploaded ── */
                    ) : note.type === 'auto' && note.action === 'File Uploaded' && note.fieldChanged ? (
                      <div>
                        <span style={{
                          display: 'inline-block',
                          background: '#f0fdf4',
                          color: '#15803d',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          marginBottom: '6px'
                        }}>📎 File Uploaded</span>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          fontSize: '11px'
                        }}>
                          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px', fontWeight: 500 }}>Field</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{decodeHtml(note.fieldChanged)}</span>
                            <span style={{ color: '#94a3b8', fontWeight: 700 }}>→</span>
                            <span style={{ color: '#0369a1', fontWeight: 500 }}>{decodeHtml(note.newValue)}</span>
                          </div>
                        </div>
                      </div>

                    /* ── Manual Comment ── */
                    ) : note.type === 'manual' ? (
                      <div>
                        <span style={{
                          display: 'inline-block',
                          background: '#fff7ed',
                          color: '#c2410c',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          marginBottom: '6px'
                        }}>💬 Comment</span>
                        <div style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          fontSize: '12px',
                          color: '#334155',
                          lineHeight: '1.5'
                        }}>
                          {renderTextWithMentions(note.description)}
                        </div>
                        {renderAttachments(note.attachments)}
                      </div>

                    /* ── Legacy / other auto entries (Section Updated, etc.) ── */
                    ) : (
                      <div>
                        <span style={{
                          display: 'inline-block',
                          background: '#f1f5f9',
                          color: '#475569',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontSize: '10px',
                          fontWeight: 600,
                          letterSpacing: '0.3px',
                          marginBottom: '6px'
                        }}>🔧 {decodeHtml(note.action.replace('Section Updated: ', ''))}</span>
                        {note.description && (
                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '7px 10px',
                            fontSize: '11px',
                            color: '#475569',
                            whiteSpace: 'pre-line',
                            lineHeight: '1.6'
                          }}>
                            {renderTextWithMentions(note.description)}
                          </div>
                        )}
                        {renderAttachments(note.attachments)}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Status dropdown */}
                <select
                  className="log-status-select"
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
                    flexShrink: 0,
                    ...getStatusStyles(note.status)
                  }}
                >
                  <option value="pending">Pending</option>
                  <option value="done">Done</option>
                  <option value="on hold">On Hold</option>
                </select>
              </div>

              {/* Status change audit trail */}
              {note.status !== 'pending' && note.statusChangedAt && note.statusChangedBy && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  marginTop: '5px',
                  padding: '4px 8px',
                  background: note.status === 'done' ? 'rgba(22, 163, 74, 0.07)' : 'rgba(220, 38, 38, 0.07)',
                  borderRadius: '6px',
                  border: `1px solid ${note.status === 'done' ? 'rgba(22, 163, 74, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
                  fontSize: '10px',
                  color: note.status === 'done' ? '#15803d' : '#b91c1c',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>
                    Marked <strong>{note.status}</strong> by <strong>{note.statusChangedBy}</strong> on {note.statusChangedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at {note.statusChangedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

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
                  style={{ marginTop: '8px', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '600' }}>
                      {getInitials(currentUserName)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <MentionInput value={replyText} onChange={setReplyText} placeholder="Write a reply... (Type @ to mention someone)" style={{ width: '100%' }} />
                      <div style={{ marginTop: '4px' }}>
                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', border: '1px dashed #cbd5e1', borderRadius: '4px', fontSize: '10px', color: '#64748b' }}>
                          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={(e) => { setReplyFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                          📎 Attach
                        </label>
                        {replyFiles.length > 0 && (
                          <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {replyFiles.map((f, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px', background: '#f1f5f9', borderRadius: '3px', fontSize: '10px' }}>
                                {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 24, height: 24, objectFit: 'cover', borderRadius: '2px' }} /> : <span>📄</span>}
                                <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: 0 }}>✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReplyingTo(null); setReplyText(''); setReplyFiles([]); }} style={{ background: 'none', border: '1px solid #e2e8f0', color: '#64748b', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddReply(note.id); }} disabled={!replyText.trim() || isUploading} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '3px', fontSize: '11px', cursor: (replyText.trim() && !isUploading) ? 'pointer' : 'not-allowed', opacity: (replyText.trim() && !isUploading) ? 1 : 0.5 }}>{isUploading ? 'Uploading…' : 'Reply'}</button>
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
                              {renderAttachments(reply.attachments)}
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
                                <div style={{ marginTop: '6px', padding: '6px', background: 'white', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: '600' }}>
                                      {getInitials(currentUserName)}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <MentionInput value={replyText} onChange={setReplyText} placeholder={`Reply to ${reply.userName}...`} style={{ width: '100%' }} />
                                      <div style={{ marginTop: '3px' }}>
                                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '2px 5px', border: '1px dashed #cbd5e1', borderRadius: '3px', fontSize: '9px', color: '#64748b' }}>
                                          <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.csv" style={{ display: 'none' }} onChange={(e) => { setReplyFiles(prev => [...prev, ...Array.from(e.target.files || [])]); e.target.value = ''; }} />
                                          📎 Attach
                                        </label>
                                        {replyFiles.length > 0 && (
                                          <div style={{ marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                            {replyFiles.map((f, i) => (
                                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 4px', background: '#f1f5f9', borderRadius: '2px', fontSize: '9px' }}>
                                                {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt={f.name} style={{ width: 18, height: 18, objectFit: 'cover', borderRadius: '2px' }} /> : <span>📄</span>}
                                                <span style={{ maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                                <button type="button" onClick={() => setReplyFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '9px', padding: 0 }}>✕</button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px', marginTop: '4px' }}>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); setReplyingTo(null); setReplyText(''); setReplyFiles([]); }} style={{ padding: '3px 8px', fontSize: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', borderRadius: '3px', cursor: 'pointer' }}>Cancel</button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleAddNestedReply(note.id, reply.id); }} disabled={!replyText.trim() || isUploading} style={{ padding: '3px 8px', fontSize: '10px', border: 'none', background: '#3b82f6', color: 'white', borderRadius: '3px', cursor: (replyText.trim() && !isUploading) ? 'pointer' : 'not-allowed', opacity: (replyText.trim() && !isUploading) ? 1 : 0.5 }}>{isUploading ? '…' : 'Reply'}</button>
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

      {/* Image Lightbox */}
      {lightboxSrc && createPortal(
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, cursor: 'zoom-out' }}
          onClick={() => setLightboxSrc(null)}
        >
          <img
            src={lightboxSrc}
            alt="Preview"
            style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, boxShadow: '0 20px 60px rgba(0,0,0,0.5)', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setLightboxSrc(null)}
            style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', width: 40, height: 40, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >✕</button>
        </div>,
        document.body
      )}

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
              {renderAttachments(selectedNote.attachments, true)}
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
                            {renderAttachments((reply as any).attachments)}
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