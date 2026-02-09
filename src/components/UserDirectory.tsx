import React, { useState, useEffect } from 'react';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  department?: string;
  position?: string;
  role?: string;
  profileImageR2Path?: string;
}

interface UserDirectoryProps {
  currentUser: User;
  onViewProfile: (user: User) => void;
  onMessageUser: (user: User) => void;
  onClose: () => void;
}

const UserDirectory: React.FC<UserDirectoryProps> = ({ 
  currentUser, 
  onViewProfile, 
  onMessageUser,
  onClose 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = () => {
    const usersData = localStorage.getItem('crm_users');
    if (usersData) {
      const allUsers = JSON.parse(usersData);
      // Filter out current user
      setUsers(allUsers.filter((u: User) => u.id !== currentUser.id));
    }
  };

  // Check if current user is admin
  const isCurrentUserAdmin = () => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return false;
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: User) => u.id === currentUser.id);
      return user && user.role === 'admin';
    } catch {
      return false;
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDepartment = !filterDepartment || user.department === filterDepartment;
    const matchesRole = !filterRole || user.role === filterRole;

    return matchesSearch && matchesDepartment && matchesRole;
  });

  const departments = [...new Set(users.map(u => u.department).filter(Boolean))];
  const roles = [...new Set(users.map(u => u.role).filter(Boolean))];

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
      zIndex: 10000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>
              👥 User Directory
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>
              {filteredUsers.length} {filteredUsers.length === 1 ? 'user' : 'users'} found
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Search and Filters */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search by name, username, or email..."
            style={{
              flex: 1,
              minWidth: '250px',
              padding: '10px 14px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: '10px 14px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>

        {/* User List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px'
        }}>
          {filteredUsers.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>👤</div>
              <p style={{ fontSize: '16px', margin: 0 }}>No users found</p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px'
            }}>
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  style={{
                    background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
                    e.currentTarget.style.borderColor = '#3b82f6';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '600',
                      flexShrink: 0
                    }}>
                      {getInitials(user.fullName)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#1e293b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {user.fullName}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        @{user.username}
                      </div>
                    </div>
                  </div>

                  {user.position && (
                    <div style={{
                      fontSize: '13px',
                      color: '#475569',
                      marginBottom: '4px'
                    }}>
                      📋 {user.position}
                    </div>
                  )}
                  
                  {user.department && (
                    <div style={{
                      fontSize: '13px',
                      color: '#475569',
                      marginBottom: '12px'
                    }}>
                      🏢 {user.department}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    paddingTop: '12px',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <button
                      onClick={() => onViewProfile(user)}
                      style={{
                        flex: 1,
                        padding: '8px',
                        background: '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      View Profile
                    </button>
                    {isCurrentUserAdmin() && (
                      <button
                        onClick={() => onMessageUser(user)}
                        style={{
                          padding: '8px 12px',
                          background: '#f1f5f9',
                          color: '#3b82f6',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '18px',
                          cursor: 'pointer'
                        }}
                        title="Message"
                      >
                        💬
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDirectory;
