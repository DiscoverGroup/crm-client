import React, { useState, useEffect, useRef } from 'react';
import { MessagingService, type Message, type Conversation } from '../services/messagingService';
import NewMessageModal from './NewMessageModal';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    if (selectedUserId) {
      loadDirectMessage(selectedUserId, selectedUserName || '');
    }
    
    // Refresh conversations every 5 seconds
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
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

  const loadConversations = () => {
    const allConvs = MessagingService.getAllConversations(currentUser.id);
    // Filter out archived conversations
    const nonArchivedConvs = allConvs.filter(conv => {
      const isArchived = MessagingService.isConversationArchived(
        conv.isGroup ? undefined : conv.userId,
        conv.isGroup ? conv.groupId : undefined
      );
      return !isArchived;
    });
    setConversations(nonArchivedConvs);
  };

  const loadDirectMessage = (userId: string, userName: string) => {
    const conv = MessagingService.getConversation(currentUser.id, userId);
    setMessages(conv);
    setActiveConversationId(userId);
    setActiveConversationName(userName);
    setIsGroupChat(false);
    
    // Mark as read
    MessagingService.markAsRead(currentUser.id, userId);
    loadConversations();
  };

  const loadGroupChat = (groupId: string, groupName: string) => {
    const msgs = MessagingService.getGroupMessages(groupId);
    setMessages(msgs);
    setActiveConversationId(groupId);
    setActiveConversationName(groupName);
    setIsGroupChat(true);
    
    // Mark as read
    MessagingService.markGroupAsRead(currentUser.id, groupId);
    loadConversations();
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeConversationId) return;

    if (isGroupChat) {
      MessagingService.sendGroupMessage(
        currentUser.id,
        currentUser.fullName,
        activeConversationId,
        newMessage.trim()
      );
      loadGroupChat(activeConversationId, activeConversationName);
    } else {
      MessagingService.sendMessage(
        currentUser.id,
        currentUser.fullName,
        activeConversationId,
        activeConversationName,
        newMessage.trim()
      );
      loadDirectMessage(activeConversationId, activeConversationName);
    }

    setNewMessage('');
    loadConversations();
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
    setEditText(message.message);
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

  const handleDeleteMessage = (messageId: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      MessagingService.deleteMessage(messageId);
      if (isGroupChat) {
        loadGroupChat(activeConversationId!, activeConversationName);
      } else {
        loadDirectMessage(activeConversationId!, activeConversationName);
      }
    }
    setContextMenu(null);
  };

  const handleCopyMessage = (message: Message) => {
    navigator.clipboard.writeText(message.message);
    setContextMenu(null);
  };

  const handleDeleteConversation = () => {
    if (confirm('Are you sure you want to delete this conversation? This cannot be undone.')) {
      MessagingService.deleteConversation(
        currentUser.id,
        isGroupChat ? undefined : activeConversationId!,
        isGroupChat ? activeConversationId! : undefined
      );
      setActiveConversationId(null);
      setActiveConversationName('');
      setMessages([]);
      setShowConversationList(true);
      setShowChatMenu(false);
      loadConversations();
    }
  };

  const handleArchiveConversation = () => {
    const isArchived = MessagingService.isConversationArchived(
      isGroupChat ? undefined : activeConversationId!,
      isGroupChat ? activeConversationId! : undefined
    );
    
    MessagingService.toggleArchiveConversation(
      isGroupChat ? undefined : activeConversationId!,
      isGroupChat ? activeConversationId! : undefined
    );
    
    setActiveConversationId(null);
    setActiveConversationName('');
    setMessages([]);
    setShowConversationList(true);
    setShowChatMenu(false);
    loadConversations();
    
    alert(isArchived ? 'Conversation unarchived' : 'Conversation archived');
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
      setShowReactionPicker(null);
      setShowChatMenu(false);
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
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>
                💬 Messages
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
          </div>

          {/* Conversations */}
          <div style={{
            flex: 1,
            overflowY: 'auto'
          }}>
            {conversations.length === 0 ? (
              <div style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                <p style={{ margin: 0, fontSize: '14px' }}>No conversations yet</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.isGroup ? conv.groupId : conv.userId}
                  onClick={() => {
                    if (conv.isGroup) {
                      loadGroupChat(conv.groupId!, conv.groupName!);
                    } else {
                      loadDirectMessage(conv.userId!, conv.userName!);
                    }
                    setShowConversationList(false); // Hide list on mobile
                  }}
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: activeConversationId === (conv.isGroup ? conv.groupId : conv.userId) ? '#f0f9ff' : 'white',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (activeConversationId !== (conv.isGroup ? conv.groupId : conv.userId)) {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (activeConversationId !== (conv.isGroup ? conv.groupId : conv.userId)) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
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
                        {conv.isGroup ? conv.groupName : conv.userName}
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
                        color: '#94a3b8'
                      }}>
                        {formatTime(conv.lastMessageTime)}
                      </div>
                    )}
                  </div>
                </div>
              ))
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
                  {isGroupChat && (
                    <div style={{
                      fontSize: '13px',
                      color: '#64748b'
                    }}>
                      Group Chat
                    </div>
                  )}
                </div>
                
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
                      <span>📦</span> {MessagingService.isConversationArchived(
                        isGroupChat ? undefined : activeConversationId!,
                        isGroupChat ? activeConversationId! : undefined
                      ) ? 'Unarchive' : 'Archive'}
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
                          title={formatFullTimestamp(message.timestamp)}
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
                                {message.message}
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
                          {formatTime(message.timestamp)}
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
                  gap: '12px',
                  alignItems: 'center'
                }}>
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
                    placeholder="Type a message..."
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '10px',
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    style={{
                      padding: '12px 24px',
                      background: newMessage.trim() 
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                        : '#e2e8f0',
                      color: newMessage.trim() ? 'white' : '#94a3b8',
                      border: 'none',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: newMessage.trim() ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Send
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
