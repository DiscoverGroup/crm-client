import React from 'react';

interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  department?: string;
  position?: string;
  role?: string;
  profileImageR2Path?: string;
  phone?: string;
  status?: string;
}

interface UserProfileViewProps {
  user: User;
  currentUser: User;
  onClose: () => void;
  onMessage: (user: User) => void;
}

const UserProfileView: React.FC<UserProfileViewProps> = ({ 
  user, 
  currentUser,
  onClose,
  onMessage 
}) => {
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Check if current user is admin
  const isCurrentUserAdmin = () => {
    const usersData = localStorage.getItem('crm_users');
    if (!usersData) return false;
    try {
      const users = JSON.parse(usersData);
      const user = users.find((u: any) => u.id === currentUser.id);
      return user && user.role === 'admin';
    } catch {
      return false;
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
      zIndex: 10001,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Header with Cover */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '16px 16px 0 0',
          padding: '40px 24px 80px',
          position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'white'
            }}
          >
            ✕
          </button>
        </div>

        {/* Profile Picture and Name */}
        <div style={{
          padding: '0 24px 24px',
          marginTop: '-60px',
          position: 'relative'
        }}>
          <div style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
            fontWeight: '600',
            border: '6px solid white',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            marginBottom: '16px'
          }}>
            {getInitials(user.fullName)}
          </div>

          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            color: '#1e293b',
            fontWeight: '700'
          }}>
            {user.fullName}
          </h2>

          <p style={{
            margin: '0 0 16px 0',
            fontSize: '16px',
            color: '#64748b'
          }}>
            @{user.username}
          </p>

          {user.position && (
            <div style={{
              display: 'inline-block',
              padding: '6px 12px',
              background: '#f1f5f9',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#475569',
              fontWeight: '500',
              marginBottom: '24px'
            }}>
              {user.position}
            </div>
          )}
        </div>

        {/* User Information */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0 24px 24px'
        }}>
          <div style={{
            background: '#f8fafc',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '16px',
              color: '#1e293b',
              fontWeight: '600'
            }}>
              Contact Information
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px'
                }}>
                  📧
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '12px',
                    color: '#64748b',
                    marginBottom: '2px'
                  }}>
                    Email
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: '#1e293b',
                    fontWeight: '500'
                  }}>
                    {user.email}
                  </div>
                </div>
              </div>

              {user.department && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    🏢
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginBottom: '2px'
                    }}>
                      Department
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#1e293b',
                      fontWeight: '500'
                    }}>
                      {user.department}
                    </div>
                  </div>
                </div>
              )}

              {user.role && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    background: 'white',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px'
                  }}>
                    👤
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: '12px',
                      color: '#64748b',
                      marginBottom: '2px'
                    }}>
                      Role
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#1e293b',
                      fontWeight: '500'
                    }}>
                      {user.role}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {user.id !== currentUser.id && isCurrentUserAdmin() && (
            <button
              onClick={() => onMessage(user)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              💬 Send Message
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileView;
