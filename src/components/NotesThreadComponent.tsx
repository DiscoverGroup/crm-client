import React, { useState, useEffect, useRef } from 'react';
import { FileService } from '../services/fileService';
import { ClientService } from '../services/clientService';
import { sanitizeComment, containsAttackPatterns } from '../utils/formSanitizer';
import { authHeaders } from '../utils/authToken';
import Loader from './Loader';
import MentionInput from './MentionInput';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NoteAttachment {
  id: string;
  name: string;
  url: string;
  r2Path: string;
  type: string;
  size: number;
}

export interface NoteReply {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  attachments: NoteAttachment[];
  replies: NoteReply[];
}

export interface NoteThread {
  id: string;
  department: string;
  request: string;
  date: string; // legacy — kept for backward compat
  startDate?: string;
  endDate?: string;
  authorId: string;
  authorName: string;
  timestamp: string;
  replies: NoteReply[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `nt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = diffMs / (1000 * 60 * 60);

  if (diffH < 1) {
    const diffM = Math.floor(diffMs / (1000 * 60));
    return diffM <= 0 ? 'just now' : `${diffM}m ago`;
  }
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  return '📎';
}

// ── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

// ── AvatarBubble ─────────────────────────────────────────────────────────────

const AvatarBubble: React.FC<{ name: string; size?: number; color?: string }> = ({
  name,
  size = 28,
  color = '#f59e0b',
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.38,
      fontWeight: 700,
      flexShrink: 0,
    }}
  >
    {getInitials(name)}
  </div>
);

// ── AttachmentChip ────────────────────────────────────────────────────────────

const AttachmentChip: React.FC<{ att: NoteAttachment }> = ({ att }) => {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (att.r2Path) {
        const res = await fetch(
          `/.netlify/functions/download-file?path=${encodeURIComponent(att.r2Path)}`,
          { headers: authHeaders() }
        );
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = att.name;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
      }
      // Fallback: direct URL
      window.open(att.url, '_blank');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      title={`${att.name} (${formatFileSize(att.size)})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        background: '#fef3c7',
        border: '1px solid #fbbf24',
        borderRadius: 6,
        fontSize: 11,
        color: '#92400e',
        cursor: loading ? 'wait' : 'pointer',
        fontWeight: 500,
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '⏳' : fileIcon(att.type)}{' '}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{att.name}</span>
    </button>
  );
};

// ── ReplyFileInput ────────────────────────────────────────────────────────────

interface ReplyFileInputProps {
  onFile: (file: File) => void;
  onClear: () => void;
  selected: File | null;
  uploading: boolean;
}

const ReplyFileInput: React.FC<ReplyFileInputProps> = ({
  onFile,
  onClear,
  selected,
  uploading,
}) => {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input
        ref={ref}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (f.size > MAX_SIZE) {
            alert(`File too large (max 50 MB). Your file is ${(f.size / 1024 / 1024).toFixed(1)} MB.`);
            e.target.value = '';
            return;
          }
          if (!ALLOWED_TYPES.includes(f.type)) {
            alert('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed.');
            e.target.value = '';
            return;
          }
          onFile(f);
        }}
      />
      {!selected ? (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          style={{
            background: 'none',
            border: '1px dashed #d1d5db',
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 11,
            color: '#6b7280',
            cursor: 'pointer',
          }}
        >
          📎 Attach file
        </button>
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            background: uploading ? '#f3f4f6' : '#fef3c7',
            border: '1px solid #fbbf24',
            borderRadius: 6,
            fontSize: 11,
            color: '#92400e',
          }}
        >
          {uploading ? '⏳' : fileIcon(selected.type)}{' '}
          <span
            style={{
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {selected.name}
          </span>
          {!uploading && (
            <button
              type="button"
              onClick={() => {
                onClear();
                if (ref.current) ref.current.value = '';
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                padding: 0,
                lineHeight: 1,
                fontSize: 12,
              }}
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ── ReplyThread (recursive) ───────────────────────────────────────────────────

interface ReplyTreeProps {
  reply: NoteReply;
  depth: number;
  onSubmitReply: (
    text: string,
    file: File | null,
    parentReplyId: string
  ) => Promise<void>;
  currentUserName: string;
}

const ReplyTree: React.FC<ReplyTreeProps> = ({
  reply,
  depth,
  onSubmitReply,
  currentUserName,
}) => {
  const [showReply, setShowReply] = useState(false);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSend = async () => {
    const clean = sanitizeComment(text, 2000);
    if (!clean && !file) return;
    if (clean && containsAttackPatterns(clean)) return;
    setUploading(true);
    try {
      await onSubmitReply(clean, file, reply.id);
      setText('');
      setFile(null);
      setShowReply(false);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        marginLeft: depth > 0 ? 20 : 0,
        borderLeft: depth > 0 ? '2px solid #fde68a' : 'none',
        paddingLeft: depth > 0 ? 8 : 0,
        marginTop: 6,
      }}
    >
      {/* Reply card */}
      <div
        style={{
          background: depth === 0 ? '#fffbeb' : '#fefce8',
          borderRadius: 8,
          padding: '8px 10px',
          border: '1px solid #fde68a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <AvatarBubble name={reply.authorName} size={22} color="#f59e0b" />
          <span style={{ fontWeight: 600, fontSize: 12, color: '#92400e' }}>
            {reply.authorName}
          </span>
          <span style={{ fontSize: 11, color: '#b45309', marginLeft: 'auto' }}>
            {formatTimestamp(reply.timestamp)}
          </span>
        </div>

        {reply.text && (
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: 12,
              color: '#44403c',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}
          >
            {reply.text}
          </p>
        )}

        {reply.attachments && reply.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {reply.attachments.map((att) => (
              <AttachmentChip key={att.id} att={att} />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowReply(!showReply)}
          style={{
            background: 'none',
            border: 'none',
            color: '#b45309',
            fontSize: 11,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          💬 Reply
        </button>
      </div>

      {/* Inline reply form */}
      {showReply && (
        <div
          style={{
            marginLeft: 20,
            marginTop: 6,
            padding: '8px 10px',
            background: 'white',
            borderRadius: 8,
            border: '1px solid #fde68a',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <MentionInput
            value={text}
            onChange={setText}
            placeholder={`Reply to ${reply.authorName}... (@ to mention someone)`}
            style={{ marginBottom: 6 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <ReplyFileInput
              onFile={setFile}
              onClear={() => setFile(null)}
              selected={file}
              uploading={uploading}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={uploading || (!text.trim() && !file)}
              style={{
                marginLeft: 'auto',
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: 600,
                cursor: uploading || (!text.trim() && !file) ? 'not-allowed' : 'pointer',
                opacity: uploading || (!text.trim() && !file) ? 0.5 : 1,
              }}
            >
              {uploading ? 'Sending…' : 'Send'}
            </button>
          </div>
        </div>
      )}

      {/* Nested replies */}
      {reply.replies &&
        reply.replies.map((nested) => (
          <ReplyTree
            key={nested.id}
            reply={nested}
            depth={depth + 1}
            onSubmitReply={onSubmitReply}
            currentUserName={currentUserName}
          />
        ))}
    </div>
  );
};

// ── ThreadCard ────────────────────────────────────────────────────────────────

interface ThreadCardProps {
  thread: NoteThread;
  currentUserId: string;
  currentUserName: string;
  clientId: string;
  onUpdated: (updated: NoteThread) => void;
}

const ThreadCard: React.FC<ThreadCardProps> = ({
  thread,
  currentUserId,
  currentUserName,
  clientId,
  onUpdated,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSendReply = async (
    text: string,
    file: File | null,
    parentReplyId?: string
  ) => {
    const clean = sanitizeComment(text, 2000);
    if (!clean && !file) return;

    let attachment: NoteAttachment | null = null;
    if (file) {
      try {
        const stored = await FileService.fileToStoredFile(
          file,
          `note-threads/${clientId}`
        );
        attachment = {
          id: stored.id,
          name: stored.name,
          url: stored.data,
          r2Path: stored.r2Path || '',
          type: stored.type,
          size: stored.size,
        };
      } catch {
        alert('Failed to upload file. Please try again.');
        return;
      }
    }

    const newReply: NoteReply = {
      id: generateId(),
      text: clean,
      authorId: currentUserId,
      authorName: currentUserName,
      timestamp: new Date().toISOString(),
      attachments: attachment ? [attachment] : [],
      replies: [],
    };

    // Deep clone thread and insert reply
    const addReplyToTree = (replies: NoteReply[], targetId: string): NoteReply[] => {
      return replies.map((r) => {
        if (r.id === targetId) {
          return { ...r, replies: [...(r.replies || []), newReply] };
        }
        if (r.replies && r.replies.length > 0) {
          return { ...r, replies: addReplyToTree(r.replies, targetId) };
        }
        return r;
      });
    };

    let updatedReplies: NoteReply[];
    if (!parentReplyId) {
      // Top-level reply to the thread
      updatedReplies = [...thread.replies, newReply];
    } else {
      updatedReplies = addReplyToTree(thread.replies, parentReplyId);
    }

    onUpdated({ ...thread, replies: updatedReplies });
  };

  const handleSendTopReply = async () => {
    const clean = sanitizeComment(replyText, 2000);
    if (!clean && !replyFile) return;
    if (clean && containsAttackPatterns(clean)) return;
    setUploading(true);
    try {
      await handleSendReply(clean, replyFile);
      setReplyText('');
      setReplyFile(null);
      setShowReply(false);
      setExpanded(true); // Auto-expand to show the new reply
    } finally {
      setUploading(false);
    }
  };

  const replyCount = (() => {
    let count = 0;
    const countReplies = (list: NoteReply[]) => {
      for (const r of list) {
        count++;
        if (r.replies) countReplies(r.replies);
      }
    };
    countReplies(thread.replies);
    return count;
  })();

  return (
    <div
      style={{
        background: '#fffbeb',
        borderRadius: 12,
        border: '1px solid #fde68a',
        boxShadow: '0 2px 6px rgba(251,191,36,0.12)',
        overflow: 'visible',
      }}
    >
      {/* Thread Header */}
      <div style={{ padding: '12px 14px' }}>
        {/* Meta row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 6,
            flexWrap: 'wrap',
          }}
        >
          <AvatarBubble name={thread.authorName} size={26} color="#d97706" />
          <span style={{ fontWeight: 700, fontSize: 13, color: '#92400e' }}>
            {thread.authorName}
          </span>
          {thread.department && (
            <span
              style={{
                background: '#fef9c3',
                border: '1px solid #fbbf24',
                borderRadius: 20,
                padding: '2px 9px',
                fontSize: 11,
                fontWeight: 600,
                color: '#b45309',
              }}
            >
              {thread.department}
            </span>
          )}
          {(thread.startDate || thread.date) && (
            <span
              style={{
                background: '#f3f4f6',
                borderRadius: 4,
                padding: '1px 6px',
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              📅 {thread.startDate || thread.date}
              {thread.endDate ? ` → ${thread.endDate}` : ''}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#b45309' }}>
            {formatTimestamp(thread.timestamp)}
          </span>
        </div>

        {/* Request text */}
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: 13,
            color: '#44403c',
            lineHeight: 1.55,
            wordBreak: 'break-word',
          }}
        >
          {thread.request || '(No content)'}
        </p>

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => {
              setShowReply(!showReply);
              if (!showReply) setExpanded(true);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#b45309',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              padding: 0,
              fontWeight: 500,
            }}
          >
            💬 Reply
          </button>
          {replyCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              style={{
                background: 'none',
                border: 'none',
                color: '#d97706',
                fontSize: 12,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              {expanded ? '▲' : '▼'} {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      </div>

      {/* Reply compose */}
      {showReply && (
        <div
          style={{
            borderTop: '1px solid #fde68a',
            padding: '10px 14px',
            background: 'white',
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <AvatarBubble name={currentUserName} size={24} color="#3b82f6" />
            <div style={{ flex: 1 }}>
              <MentionInput
                value={replyText}
                onChange={setReplyText}
                placeholder="Write a reply... (@ to mention someone)"
                style={{ marginBottom: 6 }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <ReplyFileInput
                  onFile={setReplyFile}
                  onClear={() => setReplyFile(null)}
                  selected={replyFile}
                  uploading={uploading}
                />
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReply(false);
                      setReplyText('');
                      setReplyFile(null);
                    }}
                    style={{
                      background: 'none',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 12,
                      cursor: 'pointer',
                      color: '#6b7280',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSendTopReply}
                    disabled={uploading || (!replyText.trim() && !replyFile)}
                    style={{
                      background: '#f59e0b',
                      color: 'white',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor:
                        uploading || (!replyText.trim() && !replyFile)
                          ? 'not-allowed'
                          : 'pointer',
                      opacity:
                        uploading || (!replyText.trim() && !replyFile) ? 0.5 : 1,
                    }}
                  >
                    {uploading ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replies section */}
      {expanded && replyCount > 0 && (
        <div
          style={{
            borderTop: '1px solid #fde68a',
            padding: '10px 14px',
            background: '#fefce8',
          }}
        >
          {thread.replies.map((reply) => (
            <ReplyTree
              key={reply.id}
              reply={reply}
              depth={0}
              onSubmitReply={async (text, file, parentId) => {
                await handleSendReply(text, file, parentId);
              }}
              currentUserName={currentUserName}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface NotesThreadComponentProps {
  clientId: string;
  currentUserId: string;
  currentUserName: string;
}

const NotesThreadComponent: React.FC<NotesThreadComponentProps> = ({
  clientId,
  currentUserId,
  currentUserName,
}) => {
  const [threads, setThreads] = useState<NoteThread[]>([]);
  const [loading, setLoading] = useState(true);

  // Compose state
  const [department, setDepartment] = useState('');
  const [request, setRequest] = useState('');
  const [noteDate, setNoteDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [noteStartDate, setNoteStartDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [noteEndDate, setNoteEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Persistence helpers ────────────────────────────────────────────────────

  const STORAGE_KEY = `crm_note_threads_${clientId}`;

  const loadFromStorage = (): NoteThread[] => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveToStorage = (list: NoteThread[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // ignore quota errors
    }
  };

  const persistThreads = async (list: NoteThread[]) => {
    saveToStorage(list);
    // Persist to MongoDB (primary store)
    try {
      await ClientService.updateClient(clientId, { noteThreads: list });
    } catch {
      // non-fatal — localStorage acts as fallback
    }
  };

  // ── Load on mount ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Show cached data immediately while fetching
        const local = loadFromStorage();
        if (local.length > 0) {
          setThreads(local);
        }
        // Sync from MongoDB to get latest data
        await ClientService.syncFromMongoDB();
        const client = ClientService.getClientById(clientId);
        if (client && client.noteThreads) {
          const remote: NoteThread[] = client.noteThreads as NoteThread[];
          setThreads(remote);
          saveToStorage(remote);
        }
      } catch {
        // If sync fails, keep showing cached localStorage data
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clientId]);

  // ── Thread CRUD ────────────────────────────────────────────────────────────

  const handleAddNote = async () => {
    const cleanDept = sanitizeComment(department, 200);
    const cleanReq = sanitizeComment(request, 2000);
    if (!cleanReq.trim() && !cleanDept.trim()) return;
    if (
      (cleanDept && containsAttackPatterns(cleanDept)) ||
      (cleanReq && containsAttackPatterns(cleanReq))
    ) {
      alert('Invalid characters detected in your input.');
      return;
    }

    setSubmitting(true);
    try {
      const newThread: NoteThread = {
        id: generateId(),
        department: cleanDept,
        request: cleanReq,
        date: noteStartDate, // legacy field kept in sync with startDate
        startDate: noteStartDate,
        endDate: noteEndDate || undefined,
        authorId: currentUserId,
        authorName: currentUserName,
        timestamp: new Date().toISOString(),
        replies: [],
      };
      const updated = [newThread, ...threads];
      setThreads(updated);
      await persistThreads(updated);
      setDepartment('');
      setRequest('');
      const today = new Date().toISOString().split('T')[0];
      setNoteDate(today);
      setNoteStartDate(today);
      setNoteEndDate('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleThreadUpdated = async (updatedThread: NoteThread) => {
    const updated = threads.map((t) =>
      t.id === updatedThread.id ? updatedThread : t
    );
    setThreads(updated);
    await persistThreads(updated);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        background:
          'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
        borderRadius: 16,
        padding: 20,
        boxShadow: '0 8px 32px rgba(251,191,36,0.12), 0 2px 8px rgba(0,0,0,0.04)',
        border: '1px solid rgba(253,230,138,0.5)',
        height: 'fit-content',
        width: '100%',
        minWidth: 0,
      }}
    >
      <h3
        style={{
          margin: '0 0 14px 0',
          color: '#92400e',
          fontSize: '1.1rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        📝 Notes & Requests
      </h3>

      {/* ── Compose new note ───────────────────────────────────────────────── */}
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 14,
          marginBottom: 16,
          border: '1px solid #fde68a',
          boxShadow: '0 2px 6px rgba(251,191,36,0.08)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 140px', minWidth: 0 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#92400e',
                display: 'block',
                marginBottom: 3,
              }}
            >
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Visa, Finance…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 10px',
                border: '1px solid #fde68a',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                background: '#fffbeb',
              }}
            />
          </div>
          <div style={{ flex: '0 1 130px', minWidth: 0 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#92400e',
                display: 'block',
                marginBottom: 3,
              }}
            >
              Start Date
            </label>
            <input
              type="date"
              value={noteStartDate}
              onChange={(e) => {
                setNoteStartDate(e.target.value);
                setNoteDate(e.target.value);
                // Auto-clear end date if it's before the new start date
                if (noteEndDate && e.target.value && noteEndDate < e.target.value) {
                  setNoteEndDate('');
                }
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 10px',
                border: '1px solid #fde68a',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                background: '#fffbeb',
              }}
            />
          </div>
          <div style={{ flex: '0 1 130px', minWidth: 0 }}>
            <label
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#92400e',
                display: 'block',
                marginBottom: 3,
              }}
            >
              End Date
            </label>
            <input
              type="date"
              value={noteEndDate}
              min={noteStartDate || undefined}
              onChange={(e) => setNoteEndDate(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '7px 10px',
                border: '1px solid #fde68a',
                borderRadius: 8,
                fontSize: 12,
                outline: 'none',
                background: '#fffbeb',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#92400e',
              display: 'block',
              marginBottom: 3,
            }}
          >
            Request / Note
          </label>
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Describe the request or note…"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
              border: '1px solid #fde68a',
              borderRadius: 8,
              fontSize: 13,
              padding: '8px 10px',
              outline: 'none',
              background: '#fffbeb',
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={handleAddNote}
            disabled={submitting || (!request.trim() && !department.trim())}
            style={{
              background:
                submitting || (!request.trim() && !department.trim())
                  ? '#d1d5db'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor:
                submitting || (!request.trim() && !department.trim())
                  ? 'not-allowed'
                  : 'pointer',
              boxShadow:
                submitting || (!request.trim() && !department.trim())
                  ? 'none'
                  : '0 4px 12px rgba(251,191,36,0.3)',
              transition: 'all 0.2s',
            }}
          >
            {submitting ? 'Posting…' : '📨 Post Note'}
          </button>
        </div>
      </div>

      {/* ── Thread count header ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
          Threads
        </span>
        <span
          style={{
            background: '#f59e0b',
            color: 'white',
            borderRadius: 10,
            padding: '2px 7px',
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {threads.length}
        </span>
      </div>

      {/* ── Thread list ────────────────────────────────────────────────────── */}
      {loading ? (
        <Loader message="Loading notes…" />
      ) : threads.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            color: '#b45309',
            padding: '32px 16px',
            fontSize: 13,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          No notes yet. Add the first note above.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {threads.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              clientId={clientId}
              onUpdated={handleThreadUpdated}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default NotesThreadComponent;
