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
    const convs = MessagingService.getAllConversations(currentUser.id);
    setConversations(convs);
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
  };

  const handleStartGroupChat = (groupId: string, groupName: string) => {
    loadGroupChat(groupId, groupName);
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
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1200px',
        height: '80vh',
        display: 'flex',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden'
      }}>
        {/* Conversations List */}
        <div style={{
          width: '320px',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
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
                <div>
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
                        marginBottom: showAvatar ? '16px' : '4px'
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
                        alignItems: isFromMe ? 'flex-end' : 'flex-start'
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
                        <div style={{
                          padding: '10px 14px',
                          borderRadius: isFromMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          background: isFromMe 
                            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                            : 'white',
                          color: isFromMe ? 'white' : '#1e293b',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
                          wordBreak: 'break-word'
                        }}>
                          {message.message}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#94a3b8',
                          marginTop: '4px',
                          padding: '0 4px'
                        }}>
                          {formatTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #e2e8f0',
                background: 'white'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
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
    </div>
  );
};

export default MessagingCenter;
