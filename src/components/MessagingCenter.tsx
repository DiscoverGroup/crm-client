import React, { useState, useEffect, useRef } from 'react';
import { MessagingService, type Message, type Conversation } from '../services/messagingService';
import NewMessageModal from './NewMessageModal';
import { uploadFileToR2 } from '../services/r2UploadService';
import R2DownloadButton from './R2DownloadButton';
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
  const [otherUserTyping] = useState(false); // TODO: Connect to real WebSocket for typing indicator
  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers] = useState<Set<string>>(new Set()); // TODO: Connect to real WebSocket for presence
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState<string>('smileys');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [currentConvIsPinned, setCurrentConvIsPinned] = useState(false);
  const [currentConvIsArchived, setCurrentConvIsArchived] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(true);
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'groups' | 'communities'>('all');
  const [isMuted, setIsMuted] = useState(false);
  const [showCustomizeChat, setShowCustomizeChat] = useState(false);
  const [editingChatName, setEditingChatName] = useState(false);
  const [newChatName, setNewChatName] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [searchInConversation, setSearchInConversation] = useState('');
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationLoadTimeoutRef = useRef<number | null>(null);
  const messageLoadTimeoutRef = useRef<number | null>(null);
  const messagePollingIntervalRef = useRef<number | null>(null);
  const lastMessageLoadTimeRef = useRef<number>(0);

  const loadConversations = async () => {
    if (isLoadingConversations) return; // Prevent concurrent requests
    
    setIsLoadingConversations(true);
    try {
      const allConvs = await MessagingService.getAllConversations(currentUser.id);
      
      // Backend now returns isPinned and isArchived, so we can use them directly
      // Filter out archived conversations
      const nonArchivedConvs = allConvs.filter(conv => !conv.isArchived);
      
      // Sort pinned conversations to top (isPinned already in conversation data)
      nonArchivedConvs.sort((a, b) => {
        // Pinned conversations first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then by last message time (newest first)
        const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
        const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
        return timeB - timeA;
      });
      
      setConversations(nonArchivedConvs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadConversations();
    if (selectedUserId) {
      loadDirectMessage(selectedUserId, selectedUserName || '');
    }
    
    // TODO: Implement real online status from WebSocket/API
    // For now, online status is disabled to avoid misleading users
    // When implementing: subscribe to presence events and update onlineUsers state
    
    // Refresh conversations every 15 seconds
    const interval = setInterval(() => {
      if (!isLoadingConversations) {
        loadConversations();
      }
    }, 15000);
    
    return () => {
      clearInterval(interval);
      if (conversationLoadTimeoutRef.current) {
        clearTimeout(conversationLoadTimeoutRef.current);
      }
      if (messageLoadTimeoutRef.current) {
        clearTimeout(messageLoadTimeoutRef.current);
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [currentUser.id]);

  useEffect(() => {
    if (activeConversationId) {
      // Clear any existing interval
      if (messagePollingIntervalRef.current) {
        clearInterval(messagePollingIntervalRef.current);
      }
      
      const interval = setInterval(() => {
        // Debounce: Only poll if not loading AND at least 8 seconds since last load
        const now = Date.now();
        const timeSinceLastLoad = now - lastMessageLoadTimeRef.current;
        
        if (!isLoadingMessages && timeSinceLastLoad >= 8000) {
          lastMessageLoadTimeRef.current = now;
          if (isGroupChat) {
            loadGroupChat(activeConversationId, activeConversationName, true);
          } else {
            loadDirectMessage(activeConversationId, activeConversationName, true);
          }
        }
        
        // TODO: Implement real typing indicator from WebSocket/API
        // For now, typing indicator is disabled to avoid misleading users
        // When implementing: listen for typing events and update otherUserTyping state
      }, 10000); // Check every 10s, but debounce actual loads
      
      messagePollingIntervalRef.current = interval;
      return () => {
        clearInterval(interval);
        messagePollingIntervalRef.current = null;
      };
    }
  }, [activeConversationId, isGroupChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const filteredConversations = conversations.filter(conv => {
    const name = (conv.isGroup ? conv.groupName : conv.userName) || '';
    const lastMsg = conv.lastMessage || '';
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           lastMsg.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply conversation filter
    if (conversationFilter === 'unread') {
      return matchesSearch && conv.unreadCount > 0;
    } else if (conversationFilter === 'groups') {
      return matchesSearch && conv.isGroup;
    } else if (conversationFilter === 'communities') {
      // Communities are special group types with announcements, events, etc.
      // Filter for groups with >10 participants or marked as community
      return matchesSearch && conv.isGroup && conv.participants && conv.participants.length > 10;
    }
    
    return matchesSearch;
  });

  const loadDirectMessage = async (userId: string, userName: string, skipConversationReload = false) => {
    if (isLoadingMessages) return; // Prevent concurrent requests
    
    setIsLoadingMessages(true);
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
      
      // Only reload conversations if needed (avoid unnecessary API calls)
      if (!skipConversationReload) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to load direct message:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const loadGroupChat = async (groupId: string, groupName: string, skipConversationReload = false) => {
    if (isLoadingMessages) return; // Prevent concurrent requests
    
    setIsLoadingMessages(true);
    try {
      const msgs = await MessagingService.getGroupMessages(currentUser.id, groupId);
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
      
      // Only reload conversations if needed (avoid unnecessary API calls)
      if (!skipConversationReload) {
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to load group chat:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachedFile) || !activeConversationId) return;

    let messageText = newMessage.trim();
    let fileUrl = '';
    
    // Upload file to R2 if attached
    if (attachedFile) {
      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB in bytes
      if (attachedFile.size > maxSize) {
        alert(`File size exceeds 50MB limit. Your file is ${(attachedFile.size / 1024 / 1024).toFixed(1)}MB.`);
        return;
      }
      
      setUploadingFile(true);
      try {
        const bucketName = import.meta.env.VITE_R2_BUCKET_NAME || 'crm-attachments';
        const uploadResult = await uploadFileToR2(attachedFile, bucketName, 'messages');
        
        if (uploadResult.success && uploadResult.url) {
          fileUrl = uploadResult.url;
          messageText = `📎 [${attachedFile.name}](${fileUrl})${messageText ? '\n' + messageText : ''}`;
        } else {
          const errorMsg = uploadResult.error || 'Unknown error';
          alert(`Failed to upload file: ${errorMsg}\n\nFile: ${attachedFile.name}\nSize: ${(attachedFile.size / 1024).toFixed(1)} KB`);
          setUploadingFile(false);
          return;
        }
      } catch (error) {
        console.error('File upload error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Network error or timeout';
        alert(`Failed to upload file: ${errorMsg}\n\nPlease check your connection and try again.\n\nFile: ${attachedFile.name}`);
        setUploadingFile(false);
        return;
      }
      setUploadingFile(false);
    }
    
    if (replyingTo) {
      messageText = `↩️ Replying to: "${replyingTo.content.substring(0, 50)}..."\n${messageText}`;
    }

    try {
      if (isGroupChat) {
        await MessagingService.sendGroupMessage(
          currentUser.id,
          currentUser.fullName,
          activeConversationId,
          messageText,
          replyingTo?.id
        );
        // Reload messages with skipConversationReload to avoid double-loading
        await loadGroupChat(activeConversationId, activeConversationName, true);
      } else {
        await MessagingService.sendMessage(
          currentUser.id,
          currentUser.fullName,
          activeConversationId,
          activeConversationName,
          messageText,
          replyingTo?.id
        );
        // Reload messages with skipConversationReload to avoid double-loading
        await loadDirectMessage(activeConversationId, activeConversationName, true);
      }

      setNewMessage('');
      setReplyingTo(null);
      clearAttachment();
      setShowEmojiPicker(false);
      
      // Optimistically update conversation list without delay
      loadConversations();
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    }
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
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Today: show time
    if (diffHours < 24 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } 
    // Yesterday: show "Yesterday"
    else if (diffDays === 1 || (diffHours < 48 && date.getDate() === now.getDate() - 1)) {
      return 'Yesterday';
    } 
    // This week: show day name
    else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } 
    // This year: show month and day
    else if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } 
    // Other years: show full date
    else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      // Revoke old preview URL to prevent memory leak
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      
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

  const handleReaction = async (messageId: string, emoji: string) => {
    await MessagingService.addReaction(messageId, currentUser.id, emoji);
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

  const handleSaveEdit = async () => {
    if (editingMessageId && editText.trim()) {
      await MessagingService.editMessage(editingMessageId, editText.trim());
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
      await MessagingService.deleteMessage(messageId);
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
    // Check if message contains file attachment link - flexible pattern
    // Matches: 📎 [filename](url) with optional whitespace
    const fileMatch = messageText.match(/📎\s*\[([^\]]+)\]\(([^)]+)\)/);
    
    if (fileMatch) {
      const fileName = fileMatch[1];
      const fileUrl = fileMatch[2];
      const remainingText = messageText.replace(fileMatch[0], '').trim();
      const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
      
      // Extract R2 path from URL (remove domain part)
      // URL format: https://pub-xxx.r2.dev/messages/1234-filename.pdf
      const r2PathMatch = fileUrl.match(/\/messages\/(.+)$/);
      const r2Path = r2PathMatch ? `messages/${r2PathMatch[1]}` : '';
      
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
                onError={(e) => {
                  // If direct URL fails, hide image and show download button instead
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {r2Path && (
                <div style={{ marginTop: '4px' }}>
                  <R2DownloadButton 
                    r2Path={r2Path}
                    style={{
                      fontSize: '11px',
                      padding: '4px 8px'
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '8px',
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
                  Click download button
                </div>
              </div>
              {r2Path && (
                <R2DownloadButton 
                  r2Path={r2Path}
                  style={{
                    fontSize: '11px',
                    padding: '4px 8px',
                    marginLeft: '4px'
                  }}
                />
              )}
            </div>
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
          maxWidth: '1600px',
          height: 'min(85vh, 800px)',
          display: 'flex',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden'
        }}>
        {/* Conversations List */}
        <div 
          className={`conversation-list ${!showConversationList ? 'hide-mobile' : ''}`}
          style={{
            width: '320px',
            minWidth: '320px',
            borderRight: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#f8fafc',
            flexShrink: 0
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

            {/* Filter Tabs */}
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              overflowX: 'auto',
              paddingBottom: '4px'
            }}>
              {[
                { key: 'all' as const, label: 'All' },
                { key: 'unread' as const, label: 'Unread' },
                { key: 'groups' as const, label: 'Groups' },
                { key: 'communities' as const, label: 'Communities' }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setConversationFilter(filter.key)}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: conversationFilter === filter.key ? '#e0f2fe' : '#f1f5f9',
                    color: conversationFilter === filter.key ? '#0284c7' : '#64748b',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {filter.label}
                </button>
              ))}
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
            {isLoadingConversations ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #e2e8f0',
                  borderTop: '4px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 12px'
                }} />
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Loading conversations...
                </p>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : filteredConversations.length === 0 ? (
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
                {/* Back Button */}
                <button
                  onClick={() => {
                    setShowConversationList(true);
                    setActiveConversationId(null);
                    setActiveConversationName('');
                    setMessages([]);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#f1f5f9';
                    e.currentTarget.style.color = '#1e293b';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'none';
                    e.currentTarget.style.color = '#64748b';
                  }}
                  title="Back to conversations"
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
                
                {/* Info Button */}
                <button
                  onClick={() => setShowChatInfo(!showChatInfo)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '20px',
                    cursor: 'pointer',
                    color: showChatInfo ? '#3b82f6' : '#64748b',
                    padding: '8px',
                    borderRadius: '50%'
                  }}
                  title={showChatInfo ? 'Hide chat info' : 'Show chat info'}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  ℹ️
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
                {isLoadingMessages ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#64748b'
                  }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
                      border: '4px solid #e2e8f0',
                      borderTop: '4px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      marginBottom: '16px'
                    }} />
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      Loading messages...
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: '#64748b'
                  }}>
                    <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                    <p style={{ margin: 0, fontSize: '14px' }}>
                      No messages yet. Start the conversation!
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => {
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
                          onContextMenu={(e) => !message.isDeleted && handleContextMenu(e, message)}
                          onTouchStart={() => handleTouchStart(message)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
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
                                      onClick={async () => {
                                        if (userId === currentUser.id) {
                                          await MessagingService.removeReaction(message.id, currentUser.id);
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
                          {isFromMe && (
                            <>
                              {message.deliveryStatus === 'sending' && <span title="Sending...">⏳</span>}
                              {message.deliveryStatus === 'sent' && <span title="Sent">✓</span>}
                              {message.deliveryStatus === 'delivered' && <span title="Delivered">✓✓</span>}
                              {message.deliveryStatus === 'failed' && <span title="Failed" style={{ color: '#ef4444' }}>⚠️</span>}
                              {message.isRead && message.seenAt && (
                                <span style={{ color: '#3b82f6' }} title={`Seen at ${formatFullTimestamp(message.seenAt)}`}>
                                  ✓✓
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
                )}
                
                {/* Typing Indicator */}
                {!isLoadingMessages && otherUserTyping && (
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

        {/* Right Sidebar - Chat Info */}
        {activeConversationId && showChatInfo && (
          <div style={{
            width: '320px',
            borderLeft: '1px solid #e2e8f0',
            backgroundColor: 'white',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Chat Info Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              {/* Chat Avatar */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: isGroupChat ? 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                color: 'white',
                fontWeight: '600',
                position: 'relative'
              }}>
                {isGroupChat ? '👥' : (activeConversationName ? activeConversationName[0].toUpperCase() : '?')}
                {!isGroupChat && onlineUsers.has(activeConversationId) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: '2px solid white'
                  }} />
                )}
              </div>

              {/* Chat Name */}
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '700',
                  color: '#1e293b',
                  textAlign: 'center'
                }}>
                  {activeConversationName}
                </h3>
                {!isGroupChat && onlineUsers.has(activeConversationId) && (
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '12px',
                    color: '#10b981',
                    textAlign: 'center'
                  }}>
                    Active now
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '8px'
              }}>
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    {isMuted ? '🔕' : '🔔'}
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Mute
                  </span>
                </button>

                <button
                  onClick={() => setShowSearchInChat(!showSearchInChat)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  title="Search in conversation"
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: showSearchInChat ? '#dbeafe' : '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    🔍
                  </div>
                  <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>
                    Search
                  </span>
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 20px'
            }}>
              {/* Search in Conversation */}
              {showSearchInChat && (
                <div style={{ marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Search messages..."
                    value={searchInConversation}
                    onChange={(e) => setSearchInConversation(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  {searchInConversation && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                      {messages.filter(m => m.content.toLowerCase().includes(searchInConversation.toLowerCase())).length} message(s) found
                    </div>
                  )}
                </div>
              )}
              
              {/* Chat Info Section */}
              <div style={{
                marginBottom: '16px'
              }}>
                <button
                  onClick={() => setShowCustomizeChat(!showCustomizeChat)}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}
                >
                  <span>Chat info</span>
                  <span style={{
                    transform: showCustomizeChat ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </button>
              </div>

              {/* Customize Chat Section */}
              <div style={{
                marginBottom: '16px'
              }}>
                <button
                  onClick={() => setShowCustomizeChat(!showCustomizeChat)}
                  style={{
                    width: '100%',
                    padding: '12px 0',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1e293b'
                  }}
                >
                  <span>Customize chat</span>
                  <span style={{
                    transform: showCustomizeChat ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </span>
                </button>

                {showCustomizeChat && (
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {/* Change Chat Name */}
                    <button
                      onClick={() => {
                        setEditingChatName(true);
                        setNewChatName(activeConversationName);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1e293b',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '18px' }}>✏️</span>
                      <span>Change chat name</span>
                    </button>

                    {/* Change Photo */}
                    <button
                      onClick={() => alert('Change photo feature coming soon!')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1e293b',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '18px' }}>📷</span>
                      <span>Change photo</span>
                    </button>

                    {/* Change Theme */}
                    <button
                      onClick={() => alert('Change theme feature coming soon!')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1e293b',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '18px' }}>🎨</span>
                      <span>Change theme</span>
                    </button>

                    {/* Change Emoji */}
                    <button
                      onClick={() => alert('Change emoji feature coming soon!')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1e293b',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '18px' }}>👍</span>
                      <span>Change emoji</span>
                    </button>

                    {/* Edit Nicknames */}
                    <button
                      onClick={() => alert('Edit nicknames feature coming soon!')}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: 'none',
                        border: 'none',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        color: '#1e293b',
                        textAlign: 'left',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <span style={{ fontSize: '18px' }}>Aa</span>
                      <span>Edit nicknames</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Members Section (for groups) */}
              {isGroupChat && (
                <div style={{
                  marginBottom: '16px'
                }}>
                  <button
                    style={{
                      width: '100%',
                      padding: '12px 0',
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}
                  >
                    <span>Chat members</span>
                    <span>▼</span>
                  </button>

                  {/* Member List */}
                  <div style={{
                    marginTop: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {/* Current User */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        color: 'white',
                        fontWeight: '600'
                      }}>
                        {currentUser.fullName[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#1e293b'
                        }}>
                          {currentUser.fullName}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#64748b'
                        }}>
                          You
                        </div>
                      </div>
                      <button style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '18px',
                        cursor: 'pointer',
                        color: '#64748b'
                      }}>
                        ⋮
                      </button>
                    </div>

                    {/* Load chat members from conversation */}
                    {conversations
                      .find(c => c.isGroup && c.groupId === activeConversationId)
                      ?.participants
                      ?.filter(pid => pid !== currentUser.id)
                      .map(participantId => {
                        const conv = conversations.find(c => c.userId === participantId);
                        return (
                          <div
                            key={participantId}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              transition: 'background 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                          >
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              color: 'white',
                              fontWeight: '600',
                              position: 'relative'
                            }}>
                              {conv?.userName?.[0] || '?'}
                              {onlineUsers.has(participantId) && (
                                <div style={{
                                  position: 'absolute',
                                  bottom: '0',
                                  right: '0',
                                  width: '10px',
                                  height: '10px',
                                  borderRadius: '50%',
                                  backgroundColor: '#10b981',
                                  border: '2px solid white'
                                }} />
                              )}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#1e293b'
                              }}>
                                {conv?.userName || 'Unknown User'}
                              </div>
                              {onlineUsers.has(participantId) && (
                                <div style={{
                                  fontSize: '12px',
                                  color: '#10b981'
                                }}>
                                  Active now
                                </div>
                              )}
                            </div>
                            <button style={{
                              background: 'none',
                              border: 'none',
                              fontSize: '18px',
                              cursor: 'pointer',
                              color: '#64748b'
                            }}>
                              ⋮
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Chat Name Modal */}
      {editingChatName && (
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
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '18px',
              fontWeight: '700',
              color: '#1e293b'
            }}>
              Change chat name
            </h3>
            <input
              type="text"
              value={newChatName}
              onChange={(e) => setNewChatName(e.target.value)}
              placeholder="Enter new chat name"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                marginBottom: '16px'
              }}
              autoFocus
            />
            <div style={{
              display: 'flex',
              gap: '8px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setEditingChatName(false);
                  setNewChatName('');
                }}
                style={{
                  padding: '10px 20px',
                  background: '#f1f5f9',
                  color: '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (newChatName.trim()) {
                    try {
                      // TODO: Add API endpoint to update group name
                      // For now, update locally and show warning
                      setActiveConversationName(newChatName.trim());
                      
                      // Update in conversations list
                      const updatedConvs = conversations.map(c => {
                        if (isGroupChat && c.groupId === activeConversationId) {
                          return { ...c, groupName: newChatName.trim() };
                        }
                        return c;
                      });
                      setConversations(updatedConvs);
                      
                      alert('Chat name updated locally. Note: This change will not persist after refresh until backend API is implemented.');
                    } catch (error) {
                      alert('Failed to update chat name.');
                    }
                  }
                  setEditingChatName(false);
                  setNewChatName('');
                }}
                style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
              setForwardingMessage(contextMenu.message);
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
      
      {/* Forward Message Modal */}
      {forwardingMessage && (
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
          zIndex: 10002
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
              Forward Message
            </h3>
            <div style={{
              padding: '12px',
              background: '#f1f5f9',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '14px',
              color: '#1e293b'
            }}>
              {forwardingMessage.content.substring(0, 100)}{forwardingMessage.content.length > 100 ? '...' : ''}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>Select conversation:</p>
              {conversations.map(conv => (
                <button
                  key={conv.isGroup ? conv.groupId : conv.userId}
                  onClick={async () => {
                    const targetId = conv.isGroup ? conv.groupId! : conv.userId!;
                    const targetName = conv.isGroup ? conv.groupName! : conv.userName!;
                    try {
                      if (conv.isGroup) {
                        await MessagingService.sendGroupMessage(
                          currentUser.id,
                          currentUser.fullName,
                          targetId,
                          `🔁 Forwarded: ${forwardingMessage.content}`
                        );
                      } else {
                        await MessagingService.sendMessage(
                          currentUser.id,
                          currentUser.fullName,
                          targetId,
                          targetName,
                          `🔁 Forwarded: ${forwardingMessage.content}`
                        );
                      }
                      alert('Message forwarded successfully!');
                      setForwardingMessage(null);
                      loadConversations();
                    } catch (error) {
                      alert('Failed to forward message.');
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    marginBottom: '8px',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                >
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: conv.isGroup ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}>
                    {conv.isGroup ? '👥' : getInitials(conv.userName || conv.groupName || '')}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      {conv.isGroup ? conv.groupName : conv.userName}
                    </div>
                    {conv.lastMessage && (
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {conv.lastMessage.substring(0, 30)}...
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setForwardingMessage(null)}
              style={{
                padding: '10px 20px',
                background: '#f1f5f9',
                color: '#64748b',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagingCenter;
