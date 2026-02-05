import React, { useState, useEffect, useRef } from 'react';
import { MessagingService, type Message, type Conversation } from '../services/messagingService';
import NewMessageModal from './NewMessageModal';
import { uploadFileToR2 } from '../services/r2UploadService';
import './MessagingCenter.css';

const emojiCategories = {
  smileys: {
    name: '😊 Smileys',
    emojis: ['😊', '😂', '🤣', '😍', '😘', '😋', '😎', '🤗', '🤔', '😴', '😇', '🥳', '🤩', '😏', '😅', '😆', '😁', '😄', '😃', '😀', '🙂', '🤪', '😜', '😝', '😛', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒']
  },
  gestures: {
    name: '👋 Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐', '🖖', '👋', '🤏', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃']
  },
  hearts: {
    name: '❤️ Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌']
  },
  animals: {
    name: '🐶 Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞']
  },
  food: {
    name: '🍕 Food',
    emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧈', '🥐', '🥖', '🥨', '🥯', '🧇', '🥞', '🧀', '🍖', '🍗', '🥩', '🥓', '🍳', '🥘', '🍲', '🥣', '🥗', '🍿', '🧈', '🧂', '🥫', '🍱', '🍘', '🍙', '🍚', '🍛', '🍜']
  },
  activities: {
    name: '⚽ Activities',
    emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿']
  },
  travel: {
    name: '✈️ Travel',
    emojis: ['✈️', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃']
  },
  objects: {
    name: '💼 Objects',
    emojis: ['💼', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '⏱️', '⏲️', '⏰']
  }
};

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

interface MessagingCenterProps {
  currentUser: User;
  selectedUserId?: string;
  selectedUserName?: string;
  onClose: () => void;
}

const MessagingCenter: React.FC<MessagingCenterProps> = ({ 
  currentUser, 
  selectedUserId,
  selectedUserName,
  onClose 
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(selectedUserId || null);
  const [activeConversationName, setActiveConversationName] = useState<string>(selectedUserName || '');
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [showConversationList, setShowConversationList] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: Message } | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<string>('smileys');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [currentConvIsPinned, setCurrentConvIsPinned] = useState(false);
  const [currentConvIsArchived, setCurrentConvIsArchived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConversations();
    if (selectedUserId) {
      loadDirectMessage(selectedUserId, selectedUserName || '');
    }
    
    // Simulate online users (in production, this would come from WebSocket/API)
    const simulateOnlineUsers = () => {
      const usersData = localStorage.getItem('crm_users');
      if (usersData) {
        const allUsers = JSON.parse(usersData);
        const randomOnline = allUsers
          .filter((u: User) => u.id !== currentUser.id && Math.random() > 0.5)
          .map((u: User) => u.id);
        setOnlineUsers(new Set(randomOnline));
      }
    };
    simulateOnlineUsers();
    
    // Refresh conversations every 5 seconds
    const interval = setInterval(() => {
      loadConversations();
      simulateOnlineUsers();
    }, 5000);
    
    return () => {
      clearInterval(interval);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (activeConversationId) {
      const interval = setInterval(() => {
        if (isGroupChat) {
          loadGroupChat(activeConversationId, activeConversationName);
        } else {
          loadDirectMessage(activeConversationId, activeConversationName);
        }
        // Simulate checking if other user is typing (would come from real-time backend)
        // In production, this would be replaced with actual WebSocket/polling logic
        const randomTyping = Math.random() < 0.05; // 5% chance
        setOtherUserTyping(randomTyping);
        if (randomTyping) {
          setTimeout(() => setOtherUserTyping(false), 3000);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeConversationId, isGroupChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const allConvs = await MessagingService.getAllConversations(currentUser.id);
      // Filter out archived conversations using Promise.all for async checks
      const archivedChecks = await Promise.all(
        allConvs.map(conv => 
          MessagingService.isConversationArchived(
            conv.isGroup ? undefined : conv.userId,
            conv.isGroup ? conv.groupId : undefined
          )
        )
      );
      const nonArchivedConvs = allConvs.filter((_, index) => !archivedChecks[index]);
      
      // Sort pinned conversations to top using Promise.all for async checks
      const pinnedChecks = await Promise.all(
        nonArchivedConvs.map(conv =>
          MessagingService.isConversationPinned(
            conv.isGroup ? undefined : conv.userId,
            conv.isGroup ? conv.groupId : undefined
          )
        )
      );
      const sorted = nonArchivedConvs.map((conv, index) => ({ ...conv, isPinned: pinnedChecks[index] }));
      sorted.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
      setConversations(sorted);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const filteredConversations = conversations.filter(conv => {
    const name = (conv.isGroup ? conv.groupName : conv.userName) || '';
    const lastMsg = conv.lastMessage || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const loadDirectMessage = async (userId: string, userName: string) => {
    try {
      const conv = await MessagingService.getConversation(currentUser.id, userId);
      setMessages(conv);
      setActiveConversationId(userId);
      setActiveConversationName(userName);
      setIsGroupChat(false);
      
      // Update pin/archive status
      const isPinned = await MessagingService.isConversationPinned(userId, undefined);
      const isArchived = await MessagingService.isConversationArchived(userId, undefined);
      setCurrentConvIsPinned(isPinned);
      setCurrentConvIsArchived(isArchived);
      
      // Mark as read
      await MessagingService.markAsRead(currentUser.id, userId);
      await loadConversations();
    } catch (error) {
      console.error('Failed to load direct message:', error);
    }
  };

  const loadGroupChat = async (groupId: string, groupName: string) => {
    try {
      const msgs = await MessagingService.getGroupMessages(groupId);
      setMessages(msgs);
      setActiveConversationId(groupId);
      setActiveConversationName(groupName);
      setIsGroupChat(true);
      
      // Update pin/archive status
      const isPinned = await MessagingService.isConversationPinned(undefined, groupId);
      const isArchived = await MessagingService.isConversationArchived(undefined, groupId);
      setCurrentConvIsPinned(isPinned);
      setCurrentConvIsArchived(isArchived);
      
      // Mark as read
      await MessagingService.markGroupAsRead(currentUser.id, groupId);
      await loadConversations();
    } catch (error) {
      console.error('Failed to load group chat:', error);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachedFile) || !activeConversationId) return;

    let messageText = newMessage.trim();
    let fileUrl = '';
    
    // Upload file to R2 if attached
    if (attachedFile) {
      setUploadingFile(true);
      try {
        const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || 'crm-attachments';
        const uploadResult = await uploadFileToR2(attachedFile, bucketName, 'messages');
        
        if (uploadResult.success && uploadResult.url) {
          fileUrl = uploadResult.url;
          messageText = `📎 [${attachedFile.name}](${fileUrl})${messageText ? '\n' + messageText : ''}`;
        } else {
          alert('Failed to upload file: ' + (uploadResult.error || 'Unknown error'));
          setUploadingFile(false);
          return;
        }
      } catch (error) {
        console.error('File upload error:', error);
        alert('Failed to upload file. Please try again.');
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }
    
    if (replyingTo) {
      messageText = `↩️ Replying to: "${replyingTo.content.substring(0, 50)}..."\n${messageText}`;
    }

    if (isGroupChat) {
      await MessagingService.sendGroupMessage(
        currentUser.id,
        currentUser.fullName,
        activeConversationId,
        messageText,
        replyingTo?.id
      );
      await loadGroupChat(activeConversationId, activeConversationName);
    } else {
      await MessagingService.sendMessage(
        currentUser.id,
        currentUser.fullName,
        activeConversationId,
        activeConversationName,
        messageText,
        replyingTo?.id
      );
      await loadDirectMessage(activeConversationId, activeConversationName);
    }

    setNewMessage('');
    setReplyingTo(null);
    clearAttachment();
    setShowEmojiPicker(false);
    await loadConversations();
  };

  const handleStartChat = (userId: string, userName: string) => {
    loadDirectMessage(userId, userName);
    setShowConversationList(false); // Hide list on mobile
  };

  const handleStartGroupChat = (groupId: string, groupName: string) => {
    loadGroupChat(groupId, groupName);
    setShowConversationList(false); // Hide list on mobile
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const formatFullTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      }
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePinConversation = async () => {
    try {
      await MessagingService.togglePinConversation(
        isGroupChat ? undefined : activeConversationId!,
        isGroupChat ? activeConversationId! : undefined
      );
      setCurrentConvIsPinned(!currentConvIsPinned);
      setShowChatMenu(false);
      await loadConversations();
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  const handleDeleteConversationFromList = async (userId?: string, groupId?: string) => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      try {
        await MessagingService.deleteConversation(
          currentUser.id,
          userId,
          groupId
        );
        setConversationMenuId(null);
        // Force reload conversations
        await loadConversations();
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    }
  };

  const handleArchiveConversationFromList = async (userId?: string, groupId?: string) => {
    try {
      await MessagingService.toggleArchiveConversation(userId, groupId);
      setConversationMenuId(null);
      await loadConversations();
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message });
  };

  const handleReaction = (messageId: string, emoji: string) => {
    MessagingService.addReaction(messageId, currentUser.id, emoji);
    if (isGroupChat) {
      loadGroupChat(activeConversationId!, activeConversationName);
    } else {
      loadDirectMessage(activeConversationId!, activeConversationName);
    }
    setShowReactionPicker(null);
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditText(message.content);
    setContextMenu(null);
  };

  const handleSaveEdit = () => {
    if (editingMessageId && editText.trim()) {
      MessagingService.editMessage(editingMessageId, editText.trim());
      setEditingMessageId(null);
      setEditText('');
      if (isGroupChat) {
        loadGroupChat(activeConversationId!, activeConversationName);
      } else {
        loadDirectMessage(activeConversationId!, activeConversationName);
      }
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      MessagingService.deleteMessage(messageId);
      if (isGroupChat) {
        await loadGroupChat(activeConversationId!, activeConversationName);
      } else {
        await loadDirectMessage(activeConversationId!, activeConversationName);
      }
    }
    setContextMenu(null);
  };

  const handleCopyMessage = async (message: Message) => {
    await navigator.clipboard.writeText(message.content);
    setContextMenu(null);
  };

  const handleDeleteConversation = async () => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      try {
        await MessagingService.deleteConversation(
          currentUser.id,
          isGroupChat ? undefined : activeConversationId!,
          isGroupChat ? activeConversationId! : undefined
        );
        setActiveConversationId(null);
        setActiveConversationName('');
        setMessages([]);
        setShowConversationList(true);
        setShowChatMenu(false);
        await loadConversations();
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    }
  };

  const handleArchiveConversation = async () => {
    try {
      await MessagingService.toggleArchiveConversation(
        isGroupChat ? undefined : activeConversationId!,
        isGroupChat ? activeConversationId! : undefined
      );
      
      const wasArchived = currentConvIsArchived;
      setActiveConversationId(null);
      setActiveConversationName('');
      setMessages([]);
      setShowConversationList(true);
      setShowChatMenu(false);
      await loadConversations();
      
      alert(wasArchived ? 'Conversation unarchived' : 'Conversation archived');
    } catch (error) {
      console.error('Failed to archive conversation:', error);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setShowReactionPicker(null);
      setShowChatMenu(false);
      setConversationMenuId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Typing indicator
  useEffect(() => {
    if (newMessage.trim()) {
      setIsTyping(true);
      const timeout = setTimeout(() => setIsTyping(false), 1000);
      return () => clearTimeout(timeout);
    } else {
      setIsTyping(false);
    }
  }, [newMessage]);

  // Touch handlers for long-press
  const handleTouchStart = (message: Message) => {
    if (message.isDeleted) return;
    const timer = setTimeout(() => {
      setContextMenu({ x: window.innerWidth / 2 - 80, y: window.innerHeight / 2, message });
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🔥'];

  // Helper function to render message with file attachments
  const renderMessageContent = (messageText: string) => {
    // Check if message contains file attachment link
    const fileMatch = messageText.match(/📎 \[(.*?)\]\((.*?)\)/);
    
    if (fileMatch) {
      const fileName = fileMatch[1];
      const fileUrl = fileMatch[2];
      const remainingText = messageText.replace(fileMatch[0], '').trim();
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
      
      return (
        <div>
          {isImage ? (
            <div style={{ marginBottom: remainingText ? '8px' : '0' }}>
              <img 
                src={fileUrl} 
                alt={fileName}
                style={{
                  maxWidth: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => window.open(fileUrl, '_blank')}
              />
            </div>
          ) : (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '8px',
                textDecoration: 'none',
                color: 'inherit',
                marginBottom: remainingText ? '8px' : '0'
              }}
            >
              <span style={{ fontSize: '24px' }}>📎</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: '600',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {fileName}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.8 }}>
                  Click to download
                </div>
              </div>
              <span style={{ fontSize: '16px' }}>⬇️</span>
            </a>
          )}
          {remainingText && <div>{remainingText}</div>}
        </div>
      );
    }
    
    return messageText;
  };

  return (
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
      padding: 'clamp(10px, 3vw, 20px)'
    }}>
      <div 
        className="messaging-container"
        style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '1200px',
          height: 'min(80vh, 700px)',
          display: 'flex',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}>
        {/* Conversations List */}
        <div 
          className={`conversation-list ${!showConversationList ? 'hide-mobile' : ''}`}
          style={{
            width: '320px',
            borderRight: '1px solid #e2e8f0',
            display: showConversationList || !activeConversationId ? 'flex' : 'none',
            flexDirection: 'column',
            backgroundColor: '#f8fafc'
          }}>
          {/* Header */}
          <div style={{
            padding: '20px',
            borderBottom: '1px solid #e2e8f0',
            background: 'white'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px'
            }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e293b' }}>
                Chats
              </h3>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>
            
            {/* Search Bar */}
            <div style={{
              position: 'relative',
              marginBottom: '12px'
            }}>
              <input
                type="text"
                placeholder="🔍 Search messages"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '20px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: '#f1f5f9'
                }}
              />
            </div>

            <button
              onClick={() => setShowNewMessageModal(true)}
              style={{
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              ✉️ New Message
            </button>

            {/* Active Now Section */}
            {onlineUsers.size > 0 && (
              <div style={{
                marginTop: '16px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0'
              }}>
                <div style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#64748b',
                  marginBottom: '8px'
                }}>
                  Active Now ({onlineUsers.size})
                </div>
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  overflowX: 'auto',
                  paddingBottom: '4px'
                }}>
                  {Array.from(onlineUsers).slice(0, 5).map(userId => {
                    const conv = conversations.find(c => c.userId === userId);
                    if (!conv) return null;
                    return (
                      <div
                        key={userId}
                        onClick={() => {
                          loadDirectMessage(userId, conv.userName!);
                          setShowConversationList(false);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          cursor: 'pointer',
                          minWidth: '60px'
                        }}
                      >
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          fontWeight: '600',
                          position: 'relative'
                        }}>
                          {getInitials(conv.userName!)}
                          <div style={{
                            position: 'absolute',
                            bottom: '2px',
                            right: '2px',
                            width: '12px',
                            height: '12px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            border: '2px solid white'
                          }} />
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#64748b',
                          marginTop: '4px',
                          textAlign: 'center',
                          maxWidth: '60px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {conv.userName!.split(' ')[0]}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Conversations */}
          <div style={{
            flex: 1,
            overflowY: 'auto'
          }}>
            {filteredConversations.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  {searchQuery ? 'No results found' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              filteredConversations.map(conv => {
                const isOnline = !conv.isGroup && conv.userId && onlineUsers.has(conv.userId);
                const convId = conv.isGroup ? conv.groupId! : conv.userId!;
                return (
                <div
                  key={convId}
                  className="conversation-item"
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: activeConversationId === convId ? '#f0f9ff' : 'white',
                    transition: 'background-color 0.2s',
                    position: 'relative'
                  }}
                  onMouseOver={(e) => {
                    if (activeConversationId !== convId) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (activeConversationId !== convId) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                    onClick={() => {
                      if (conv.isGroup) {
                        loadGroupChat(conv.groupId!, conv.groupName!);
                      } else {
                        loadDirectMessage(conv.userId!, conv.userName!);
                      }
                      setShowConversationList(false);
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: conv.isGroup 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '16px',
                      fontWeight: '600',
                      flexShrink: 0,
                      position: 'relative'
                    }}>
                      {conv.isGroup ? '👥' : getInitials(conv.userName || conv.groupName || '')}
                      {conv.unreadCount > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: '-2px',
                          right: '-2px',
                          background: '#ef4444',
                          color: 'white',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '600',
                          border: '2px solid white'
                        }}>
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </div>
                      )}
                      {isOnline && (
                        <div style={{
                          position: 'absolute',
                          bottom: '2px',
                          right: '2px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          border: '2px solid white'
                        }} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: conv.unreadCount > 0 ? '600' : '500',
                        color: '#1e293b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {conv.isPinned && <span style={{ fontSize: '12px' }}>📌</span>}
                        {conv.isGroup ? conv.groupName : conv.userName}
                        {isOnline && <span style={{ fontSize: '10px', color: '#10b981' }}>●</span>}
                        {conv.isGroup && conv.participants && (
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            ({conv.participants.length})
                          </span>
                        )}
                      </div>
                      {conv.lastMessage && (
                        <div style={{
                          fontSize: '13px',
                          color: '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {conv.lastMessage}
                        </div>
                      )}
                    </div>
                    {conv.lastMessageTime && (
                      <div style={{
                        fontSize: '11px',
                        color: '#94a3b8',
                        flexShrink: 0
                      }}>
                        {formatTime(conv.lastMessageTime)}
                      </div>
                    )}
                  </div>

                  {/* 3-Dot Options Menu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConversationMenuId(conversationMenuId === convId ? null : convId);
                    }}
                    style={{
                      position: 'absolute',
                      top: '16px',
                      right: '20px',
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '4px 8px',
                      opacity: conversationMenuId === convId ? 1 : 0,
                      transition: 'opacity 0.2s'
                    }}
                    className="conversation-options-btn"
                  >
                    ⋮
                  </button>

                  {/* Dropdown Menu */}
                  {conversationMenuId === convId && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: '45px',
                        right: '20px',
                        background: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '4px',
                        zIndex: 1000,
                        minWidth: '160px'
                      }}
                    >
                      <button
                        onClick={() => {
                          handleArchiveConversationFromList(
                            !conv.isGroup ? conv.userId : undefined,
                            conv.isGroup ? conv.groupId : undefined
                          );
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '14px',
                          color: '#1e293b'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <span>📦</span> Archive
                      </button>
                      <button
                        onClick={() => {
                          handleDeleteConversationFromList(
                            !conv.isGroup ? conv.userId : undefined,
                            conv.isGroup ? conv.groupId : undefined
                          );
                        }}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'none',
                          border: 'none',
                          textAlign: 'left',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          fontSize: '14px',
                          color: '#ef4444'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <span>🗑️</span> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
              })
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {activeConversationId ? (
            <>
              {/* Chat Header */}
              <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e2e8f0',
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                {/* Back Button for Mobile */}
                <button
                  onClick={() => {
                    setShowConversationList(true);
                    setActiveConversationId(null);
                  }}
                  style={{
                    display: 'none',
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '4px 8px'
                  }}
                  className="mobile-back-btn"
                >
                  ←
                </button>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: isGroupChat 
                    ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {isGroupChat ? '👥' : getInitials(activeConversationName)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}>
                    {activeConversationName}
                  </div>
                  {!isGroupChat && activeConversationId && onlineUsers.has(activeConversationId) ? (
                    <div style={{
                      fontSize: '13px',
                      color: '#10b981',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span>●</span> Active now
                    </div>
                  ) : isGroupChat ? (
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b'
                    }}>
                      Group Chat
                    </div>
                  ) : null}
                </div>
                
                {/* Call Buttons */}
                <button
                  onClick={() => alert('Audio call feature coming soon!')}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#3b82f6',
                    padding: '8px',
                    borderRadius: '50%'
                  }}
                  title="Audio Call"
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📞
                </button>
                <button
                  onClick={() => alert('Video call feature coming soon!')}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: '#3b82f6',
                    padding: '8px',
                    borderRadius: '50%'
                  }}
                  title="Video Call"
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📹
                </button>
                
                {/* Menu Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChatMenu(!showChatMenu);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '8px',
                    position: 'relative'
                  }}
                >
                  ⋮
                </button>

                {/* Dropdown Menu */}
                {showChatMenu && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: '70px',
                      right: '24px',
                      background: 'white',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      padding: '4px',
                      zIndex: 1000,
                      minWidth: '180px'
                    }}
                  >
                    <button
                      onClick={handlePinConversation}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#1e293b'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span>📌</span> {currentConvIsPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button
                      onClick={handleArchiveConversation}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#1e293b'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span>📦</span> {currentConvIsArchived ? 'Unarchive' : 'Archive'}
                    </button>
                    <button
                      onClick={handleDeleteConversation}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        fontSize: '14px',
                        color: '#ef4444'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span>🗑️</span> Delete Conversation
                    </button>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
                background: '#f8fafc'
              }}>
                {messages.map((message, index) => {
                  const isFromMe = message.fromUserId === currentUser.id;
                  const showAvatar = index === 0 || messages[index - 1].fromUserId !== message.fromUserId;

                  return (
                    <div
                      key={message.id}
                      style={{
                        display: 'flex',
                        justifyContent: isFromMe ? 'flex-end' : 'flex-start',
                        marginBottom: showAvatar ? '16px' : '4px',
                        position: 'relative'
                      }}
                      onContextMenu={(e) => !message.isDeleted && handleContextMenu(e, message)}
                      onTouchStart={() => handleTouchStart(message)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                    >
                      {!isFromMe && showAvatar && (
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '600',
                          marginRight: '8px',
                          flexShrink: 0
                        }}>
                          {getInitials(message.fromUserName)}
                        </div>
                      )}
                      {!isFromMe && !showAvatar && (
                        <div style={{ width: '40px', flexShrink: 0 }} />
                      )}
                      <div style={{
                        maxWidth: '60%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isFromMe ? 'flex-end' : 'flex-start',
                        position: 'relative'
                      }}>
                        {isGroupChat && !isFromMe && showAvatar && (
                          <div style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#64748b',
                            marginBottom: '4px',
                            padding: '0 4px'
                          }}>
                            {message.fromUserName}
                          </div>
                        )}
                        
                        <div
                          className="message-bubble-container"
                          style={{ position: 'relative', display: 'inline-block' }}
                          title={formatFullTimestamp(typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp)}
                        >
                          {editingMessageId === message.id ? (
                            <div style={{
                              padding: '10px 14px',
                              borderRadius: isFromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                              background: isFromMe ? '#dbeafe' : '#f1f5f9',
                              display: 'flex',
                              gap: '8px'
                            }}>
                              <input
                                type="text"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit();
                                  if (e.key === 'Escape') setEditingMessageId(null);
                                }}
                                autoFocus
                                style={{
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  fontSize: '14px',
                                  flex: 1
                                }}
                              />
                              <button onClick={handleSaveEdit} style={{
                                background: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}>✓</button>
                              <button onClick={() => setEditingMessageId(null)} style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}>✕</button>
                            </div>
                          ) : (
                            <>
                              <div style={{
                                padding: '10px 14px',
                                borderRadius: isFromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                background: message.isDeleted 
                                  ? '#f3f4f6' 
                                  : isFromMe 
                                    ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                                    : 'white',
                                color: message.isDeleted ? '#9ca3af' : isFromMe ? 'white' : '#1e293b',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                                wordBreak: 'break-word',
                                fontStyle: message.isDeleted ? 'italic' : 'normal',
                                position: 'relative'
                              }}>
                                {renderMessageContent(message.content)}
                                {message.isEdited && !message.isDeleted && (
                                  <span style={{
                                    fontSize: '10px',
                                    opacity: 0.7,
                                    marginLeft: '6px'
                                  }}>
                                    (edited)
                                  </span>
                                )}
                                
                                {/* Reaction button */}
                                {!message.isDeleted && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowReactionPicker(showReactionPicker === message.id ? null : message.id);
                                    }}
                                    className="reaction-btn"
                                    style={{
                                      position: 'absolute',
                                      top: '-10px',
                                      right: isFromMe ? 'auto' : '-10px',
                                      left: isFromMe ? '-10px' : 'auto',
                                      background: 'white',
                                      border: '1px solid #e2e8f0',
                                      borderRadius: '50%',
                                      width: '24px',
                                      height: '24px',
                                      display: 'none',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      fontSize: '14px',
                                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    😊
                                  </button>
                                )}
                              </div>
                              
                              {/* Reactions display */}
                              {message.reactions && Object.keys(message.reactions).length > 0 && (
                                <div style={{
                                  display: 'flex',
                                  gap: '4px',
                                  flexWrap: 'wrap',
                                  marginTop: '4px'
                                }}>
                                  {Object.entries(message.reactions).map(([userId, emoji]) => (
                                    <span
                                      key={userId}
                                      onClick={() => {
                                        if (userId === currentUser.id) {
                                          MessagingService.removeReaction(message.id, currentUser.id);
                                          if (isGroupChat) {
                                            loadGroupChat(activeConversationId!, activeConversationName);
                                          } else {
                                            loadDirectMessage(activeConversationId!, activeConversationName);
                                          }
                                        }
                                      }}
                                      style={{
                                        background: userId === currentUser.id ? '#dbeafe' : '#f1f5f9',
                                        borderRadius: '12px',
                                        padding: '2px 8px',
                                        fontSize: '14px',
                                        cursor: userId === currentUser.id ? 'pointer' : 'default',
                                        border: userId === currentUser.id ? '2px solid #3b82f6' : 'none'
                                      }}
                                      title={userId === currentUser.id ? 'Click to remove' : ''}
                                    >
                                      {emoji}
                                    </span>
                                  ))}
                                </div>
                              )}
                              
                              {/* Reaction picker */}
                              {showReactionPicker === message.id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  style={{
                                    position: 'absolute',
                                    top: '-50px',
                                    [isFromMe ? 'right' : 'left']: '0',
                                    background: 'white',
                                    borderRadius: '24px',
                                    padding: '8px 12px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    display: 'flex',
                                    gap: '8px',
                                    zIndex: 10
                                  }}
                                >
                                  {reactions.map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(message.id, emoji)}
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '20px',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        borderRadius: '50%',
                                        transition: 'transform 0.2s'
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.3)'}
                                      onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginTop: '4px',
                          padding: '0 4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          {formatTime(typeof message.timestamp === 'string' ? new Date(message.timestamp) : message.timestamp)}
                          {isFromMe && message.isRead && message.seenAt && (
                            <span style={{ fontSize: '10px' }} title={`Seen at ${formatFullTimestamp(message.seenAt)}`}>
                              • Seen
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Typing Indicator */}
                {otherUserTyping && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    marginLeft: '40px'
                  }}>
                    <div style={{
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                      background: 'white',
                      padding: '10px 14px',
                      borderRadius: '16px 16px 16px 4px',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                    }}>
                      <div className="typing-dot" style={{
                        width: '8px',
                        height: '8px',
                        background: '#94a3b8',
                        borderRadius: '50%',
                        animation: 'typing 1.4s infinite'
                      }} />
                      <div className="typing-dot" style={{
                        width: '8px',
                        height: '8px',
                        background: '#94a3b8',
                        borderRadius: '50%',
                        animation: 'typing 1.4s infinite 0.2s'
                      }} />
                      <div className="typing-dot" style={{
                        width: '8px',
                        height: '8px',
                        background: '#94a3b8',
                        borderRadius: '50%',
                        animation: 'typing 1.4s infinite 0.4s'
                      }} />
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: 'white'
              }}>
                {/* Reply Banner */}
                {replyingTo && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>
                        Replying to {replyingTo.fromUserName}
                      </div>
                      <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>
                        {replyingTo.content.substring(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyingTo(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* File Preview */}
                {attachedFile && (
                  <div style={{
                    padding: '8px 12px',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '4px',
                          objectFit: 'cover'
                        }} />
                      ) : (
                        <div style={{ fontSize: '24px' }}>📎</div>
                      )}
                      <div>
                        <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: '600' }}>
                          {attachedFile.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {(attachedFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={clearAttachment}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {isTyping && (
                  <div style={{
                    fontSize: '11px',
                    color: '#94a3b8',
                    marginBottom: '8px',
                    fontStyle: 'italic'
                  }}>
                    typing...
                  </div>
                )}
                
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-end',
                  position: 'relative'
                }}>
                  {/* Emoji Picker Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEmojiPicker(!showEmojiPicker);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                    title="Add emoji"
                  >
                    😊
                  </button>

                  {/* File Attach Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/*,application/pdf,.doc,.docx"
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '24px',
                      cursor: 'pointer',
                      padding: '8px'
                    }}
                    title="Attach file"
                  >
                    📎
                  </button>

                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      setIsTyping(true);
                    }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                        setIsTyping(false);
                      }
                    }}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder="Aa"
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '20px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />

                  {/* Emoji Picker Popup */}
                  {showEmojiPicker && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        bottom: '60px',
                        left: '0',
                        background: 'white',
                        borderRadius: '16px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                        zIndex: 10001,
                        width: '360px',
                        maxHeight: '320px',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Category Tabs */}
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        padding: '12px 12px 8px 12px',
                        borderBottom: '1px solid #e2e8f0',
                        overflowX: 'auto',
                        scrollbarWidth: 'thin'
                      }}>
                        {Object.entries(emojiCategories).map(([key, category]) => (
                          <button
                            key={key}
                            onClick={() => setEmojiCategory(key)}
                            style={{
                              background: emojiCategory === key ? '#e0f2fe' : 'transparent',
                              border: 'none',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              fontSize: '20px',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              whiteSpace: 'nowrap',
                              color: emojiCategory === key ? '#0284c7' : '#64748b'
                            }}
                            onMouseOver={(e) => {
                              if (emojiCategory !== key) {
                                e.currentTarget.style.background = '#f1f5f9';
                              }
                            }}
                            onMouseOut={(e) => {
                              if (emojiCategory !== key) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                            title={category.name}
                          >
                            {category.name.split(' ')[0]}
                          </button>
                        ))}
                      </div>
                      
                      {/* Emoji Grid */}
                      <div style={{
                        padding: '12px',
                        overflowY: 'auto',
                        maxHeight: '240px'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(8, 1fr)',
                          gap: '4px'
                        }}>
                          {emojiCategories[emojiCategory as keyof typeof emojiCategories].emojis.map(emoji => (
                            <button
                              key={emoji}
                              onClick={() => {
                                setNewMessage(prev => prev + emoji);
                                setShowEmojiPicker(false);
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                fontSize: '28px',
                                cursor: 'pointer',
                                padding: '8px',
                                borderRadius: '8px',
                                width: '40px',
                                height: '40px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                                e.currentTarget.style.transform = 'scale(1.2)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.background = 'none';
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() && !attachedFile || uploadingFile}
                    style={{
                      padding: '12px',
                      background: (newMessage.trim() || attachedFile) && !uploadingFile
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#e2e8f0',
                      color: (newMessage.trim() || attachedFile) && !uploadingFile ? 'white' : '#94a3b8',
                      border: 'none',
                      borderRadius: '50%',
                      fontSize: '18px',
                      cursor: (newMessage.trim() || attachedFile) && !uploadingFile ? 'pointer' : 'not-allowed',
                      width: '44px',
                      height: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title={uploadingFile ? 'Uploading...' : 'Send'}
                  >
                    {uploadingFile ? '⏳' : '➤'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ fontSize: '64px' }}>💬</div>
              <p style={{ margin: 0, fontSize: '16px' }}>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>

      {showNewMessageModal && (
        <NewMessageModal
          currentUser={currentUser}
          onClose={() => setShowNewMessageModal(false)}
          onStartChat={handleStartChat}
          onStartGroupChat={handleStartGroupChat}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            padding: '4px',
            zIndex: 1000,
            minWidth: '160px'
          }}
        >
          <button
            onClick={() => {
              setReplyingTo(contextMenu.message);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              color: '#1e293b'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <span>↩️</span> Reply
          </button>
          <button
            onClick={() => {
              handleCopyMessage(contextMenu.message);
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              color: '#1e293b'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <span>📋</span> Copy
          </button>
          {contextMenu.message.fromUserId === currentUser.id && (
            <>
              <button
                onClick={() => {
                  handleEditMessage(contextMenu.message);
                  setContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#1e293b'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <span>✏️</span> Edit
              </button>
              <button
                onClick={() => {
                  handleDeleteMessage(contextMenu.message.id);
                  setContextMenu(null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  color: '#ef4444'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                onMouseOut={(e) => e.currentTarget.style.background = 'none'}
              >
                <span>🗑️</span> Delete
              </button>
            </>
          )}
          <button
            onClick={() => {
              alert('Forward feature coming soon!');
              setContextMenu(null);
            }}
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'none',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '14px',
              color: '#1e293b'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
          >
            <span>↪️</span> Forward
          </button>
        </div>
      )}
    </div>
  );
};

export default MessagingCenter;
