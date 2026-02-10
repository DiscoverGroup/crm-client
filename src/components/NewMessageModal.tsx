import React, { useState, useEffect } from 'react';
import { MessagingService } from '../services/messagingService';
import { showWarningToast } from '../utils/toast';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

interface NewMessageModalProps {
  currentUser: User;
  onClose: () => void;
  onStartChat: (userId: string, userName: string) => void;
  onStartGroupChat: (groupId: string, groupName: string) => void;
}

const NewMessageModal: React.FC<NewMessageModalProps> = ({
  currentUser,
  onClose,
  onStartChat,
  onStartGroupChat
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const usersData = localStorage.getItem('crm_users');
    if (usersData) {
      const allUsers = JSON.parse(usersData);
      const filteredUsers = allUsers.filter((u: User) => u.id !== currentUser.id);
      setUsers(filteredUsers);
    }
  };

  const filteredUsers = users.filter(user =>
    user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (user: User) => {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleStartChat = (user: User) => {
    onStartChat(user.id, user.fullName);
    onClose();
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedUsers.length < 1) {
      showWarningToast('Please enter a group name and select at least one member');
      return;
    }

    const participantIds = [currentUser.id, ...selectedUsers.map(u => u.id)];
    const participantNames = [currentUser.fullName, ...selectedUsers.map(u => u.fullName)];
    
    const group = await MessagingService.createGroup(groupName, participantIds, participantNames, currentUser.id);
    onStartGroupChat(group.id, group.name);
    onClose();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
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
      zIndex: 10002,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
            {isCreatingGroup ? '👥 Create Group Chat' : '✉️ New Message'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            ✕
          </button>
        </div>

        {/* Mode Toggle */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px'
        }}>
          <button
            onClick={() => {
              setIsCreatingGroup(false);
              setSelectedUsers([]);
              setGroupName('');
            }}
            style={{
              flex: 1,
              padding: '10px',
              background: !isCreatingGroup ? '#3b82f6' : '#f1f5f9',
              color: !isCreatingGroup ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Direct Message
          </button>
          <button
            onClick={() => setIsCreatingGroup(true)}
            style={{
              flex: 1,
              padding: '10px',
              background: isCreatingGroup ? '#3b82f6' : '#f1f5f9',
              color: isCreatingGroup ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Group Chat
          </button>
        </div>

        {/* Group Name Input */}
        {isCreatingGroup && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name..."
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        )}

        {/* Selected Users (for group chat) */}
        {isCreatingGroup && selectedUsers.length > 0 && (
          <div style={{
            padding: '12px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {selectedUsers.map(user => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  background: '#eff6ff',
                  borderRadius: '20px',
                  fontSize: '13px',
                  color: '#1e40af'
                }}
              >
                {user.fullName}
                <button
                  onClick={() => toggleUserSelection(user)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#1e40af',
                    cursor: 'pointer',
                    padding: '0 2px',
                    fontSize: '14px'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search users..."
            style={{
              width: '100%',
              padding: '12px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        {/* User List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 24px'
        }}>
          {filteredUsers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              <p style={{ margin: 0 }}>No users found</p>
            </div>
          ) : (
            filteredUsers.map(user => (
              <div
                key={user.id}
                onClick={() => {
                  if (isCreatingGroup) {
                    toggleUserSelection(user);
                  } else {
                    handleStartChat(user);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  backgroundColor: selectedUsers.find(u => u.id === user.id) ? '#eff6ff' : 'transparent'
                }}
                onMouseOver={(e) => {
                  if (!selectedUsers.find(u => u.id === user.id)) {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }
                }}
                onMouseOut={(e) => {
                  if (!selectedUsers.find(u => u.id === user.id)) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {isCreatingGroup && (
                  <input
                    type="checkbox"
                    checked={!!selectedUsers.find(u => u.id === user.id)}
                    onChange={() => toggleUserSelection(user)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: '600',
                  flexShrink: 0
                }}>
                  {getInitials(user.fullName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#1e293b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {user.fullName}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    @{user.username}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Create Group Button */}
        {isCreatingGroup && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0'
          }}>
            <button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || selectedUsers.length === 0}
              style={{
                width: '100%',
                padding: '14px',
                background: groupName.trim() && selectedUsers.length > 0
                  ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                  : '#e2e8f0',
                color: groupName.trim() && selectedUsers.length > 0 ? 'white' : '#94a3b8',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: groupName.trim() && selectedUsers.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Create Group ({selectedUsers.length} {selectedUsers.length === 1 ? 'member' : 'members'})
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewMessageModal;
