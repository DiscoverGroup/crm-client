import React, { useState, useEffect } from 'react';
import { FileRecoveryService, type FileRecoveryRequest } from '../services/fileRecoveryService';

interface User {
  fullName: string;
  username: string;
  email: string;
  password: string;
  department: string;
  position: string;
  profileImage?: string;
  registeredAt: string;
  isVerified: boolean;
  verificationToken?: string | null;
  verificationTokenExpiry?: number | null;
  verifiedAt?: string;
  role?: string;
}

interface AdminPanelProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterVerified, setFilterVerified] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'file-recovery'>('users');
  const [recoveryRequests, setRecoveryRequests] = useState<FileRecoveryRequest[]>([]);
  const [filterRecoveryStatus, setFilterRecoveryStatus] = useState<string>('pending');

  // Get current admin user from localStorage
  const getCurrentAdmin = (): string => {
    const currentUserData = localStorage.getItem('crm_current_user');
    if (currentUserData) {
      const userData = JSON.parse(currentUserData);
      return userData.fullName || userData.username || 'Admin';
    }
    return 'Admin';
  };

  useEffect(() => {
    loadUsers();
    loadRecoveryRequests();
  }, []);

  const loadUsers = () => {
    const usersData = localStorage.getItem('crm_users');
    if (usersData) {
      try {
        const parsedUsers = JSON.parse(usersData);
        console.log('📋 AdminPanel loaded users:', parsedUsers.length);
        console.log('Users:', parsedUsers.map((u: User) => ({ email: u.email, verified: u.isVerified, role: u.role })));
        setUsers(parsedUsers);
      } catch (error) {
        console.error('Error loading users:', error);
      }
    } else {
      console.warn('⚠️ No users found in localStorage');
    }
  };

  const loadRecoveryRequests = () => {
    const requests = FileRecoveryService.getAllRequests();
    setRecoveryRequests(requests);
  };

  const saveUsers = (updatedUsers: User[]) => {
    localStorage.setItem('crm_users', JSON.stringify(updatedUsers));
    setUsers(updatedUsers);
  };

  const handleVerifyUser = (email: string) => {
    const updatedUsers = users.map(user => {
      if (user.email === email) {
        return {
          ...user,
          isVerified: true,
          verificationToken: null,
          verificationTokenExpiry: null,
          verifiedAt: new Date().toISOString()
        };
      }
      return user;
    });
    saveUsers(updatedUsers);
    alert('User verified successfully!');
  };

  const handleChangeRole = (email: string, newRole: string) => {
    const updatedUsers = users.map(user => {
      if (user.email === email) {
        return { ...user, role: newRole };
      }
      return user;
    });
    saveUsers(updatedUsers);
    alert(`User role changed to ${newRole}`);
  };

  const handleDeleteUser = (email: string) => {
    const updatedUsers = users.filter(user => user.email !== email);
    saveUsers(updatedUsers);
    setShowDeleteConfirm(null);
    alert('User deleted successfully!');
  };

  const handleApproveRecovery = (requestId: string) => {
    const request = recoveryRequests.find(r => r.id === requestId);
    if (!request) return;

    if (window.confirm(`Approve file recovery for "${request.fileName}"?`)) {
      const success = FileRecoveryService.approveRequest(requestId, getCurrentAdmin());
      if (success) {
        alert('File recovery approved successfully!');
        loadRecoveryRequests();
      } else {
        alert('Failed to approve recovery request.');
      }
    }
  };

  const handleRejectRecovery = (requestId: string) => {
    const request = recoveryRequests.find(r => r.id === requestId);
    if (!request) return;

    const reason = prompt('Enter rejection reason (optional):');
    if (reason !== null) { // User didn't cancel
      const success = FileRecoveryService.rejectRequest(requestId, getCurrentAdmin(), reason || undefined);
      if (success) {
        alert('File recovery request rejected.');
        loadRecoveryRequests();
      } else {
        alert('Failed to reject recovery request.');
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = filterRole === 'all' || (user.role || 'user') === filterRole;
    const matchesVerified = filterVerified === 'all' || 
      (filterVerified === 'verified' && user.isVerified) ||
      (filterVerified === 'unverified' && !user.isVerified);

    return matchesSearch && matchesRole && matchesVerified;
  });

  const filteredRecoveryRequests = recoveryRequests.filter(request => {
    if (filterRecoveryStatus === 'all') return true;
    return request.status === filterRecoveryStatus;
  });

  const recoveryStats = FileRecoveryService.getStatistics();

  return (
    <div style={{
      padding: '24px',
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: '#1e293b',
            margin: '0 0 8px 0'
          }}>
            {activeTab === 'users' ? '👥 User Management' : '📁 File Recovery Requests'}
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            margin: 0
          }}>
            {activeTab === 'users' 
              ? 'Manage user accounts, roles, and permissions' 
              : 'Review and approve file recovery requests'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              loadUsers();
              loadRecoveryRequests();
            }}
            style={{
              padding: '10px 20px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            title="Refresh data"
          >
            🔄 Refresh
          </button>
          <button
            onClick={onBack}
            style={{
              padding: '10px 20px',
              background: '#64748b',
              color: 'white',
              border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
          }}
        >
          ← Back to Dashboard
        </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid #e2e8f0'
      }}>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'users' ? 'white' : 'transparent',
            color: activeTab === 'users' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          👥 Users
        </button>
        <button
          onClick={() => setActiveTab('file-recovery')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'file-recovery' ? 'white' : 'transparent',
            color: activeTab === 'file-recovery' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'file-recovery' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            position: 'relative'
          }}
        >
          📁 File Recovery
          {recoveryStats.pending > 0 && (
            <span style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              background: '#ef4444',
              color: 'white',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '11px',
              fontWeight: '700',
              minWidth: '18px',
              textAlign: 'center'
            }}>
              {recoveryStats.pending}
            </span>
          )}
        </button>
      </div>

      {/* User Management Tab */}
      {activeTab === 'users' && (
        <>
      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Total Users</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{users.length}</p>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Verified</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#10b981' }}>
            {users.filter(u => u.isVerified).length}
          </p>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Unverified</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
            {users.filter(u => !u.isVerified).length}
          </p>
        </div>
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Admins</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>
            {users.filter(u => u.role === 'admin').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '16px'
        }}>
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          >
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
          <select
            value={filterVerified}
            onChange={(e) => setFilterVerified(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none'
            }}
          >
            <option value="all">All Status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>User</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Email</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Department</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Role</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Registered</th>
                <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: user.profileImage ? `url(${user.profileImage})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '16px'
                      }}>
                        {!user.profileImage && user.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{user.fullName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>{user.email}</td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>{user.department}</td>
                  <td style={{ padding: '16px' }}>
                    <select
                      value={user.role || 'user'}
                      onChange={(e) => handleChangeRole(user.email, e.target.value)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '13px',
                        background: user.role === 'admin' ? '#dbeafe' : '#f1f5f9',
                        color: user.role === 'admin' ? '#1e40af' : '#475569',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: user.isVerified ? '#d1fae5' : '#fef3c7',
                      color: user.isVerified ? '#065f46' : '#92400e'
                    }}>
                      {user.isVerified ? '✓ Verified' : '⏳ Unverified'}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>
                    {new Date(user.registeredAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {!user.isVerified && (
                        <button
                          onClick={() => handleVerifyUser(user.email)}
                          style={{
                            padding: '6px 12px',
                            background: '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer'
                          }}
                          title="Verify User"
                        >
                          ✓ Verify
                        </button>
                      )}
                      <button
                        onClick={() => setShowDeleteConfirm(user)}
                        style={{
                          padding: '6px 12px',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                        title="Delete User"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredUsers.length === 0 && (
          <div style={{
            padding: '48px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>No users found</p>
            <p style={{ fontSize: '14px', margin: 0 }}>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
        </>
      )}

      {/* File Recovery Tab */}
      {activeTab === 'file-recovery' && (
        <>
          {/* Recovery Stats Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Total Requests</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{recoveryStats.total}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Pending</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>{recoveryStats.pending}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Approved</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{recoveryStats.approved}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Rejected</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{recoveryStats.rejected}</p>
            </div>
          </div>

          {/* Filter */}
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <select
              value={filterRecoveryStatus}
              onChange={(e) => setFilterRecoveryStatus(e.target.value)}
              style={{
                padding: '10px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                width: '250px'
              }}
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Recovery Requests Table */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {filteredRecoveryRequests.length === 0 ? (
              <div style={{
                padding: '48px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📭</div>
                <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>No recovery requests</p>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  {filterRecoveryStatus === 'pending' 
                    ? 'No pending file recovery requests at this time'
                    : 'Try adjusting your filter'}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse'
                }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>File Name</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Category</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Client</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Requested By</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Requested At</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecoveryRequests.map((request) => (
                      <tr key={request.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px', color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>
                          📄 {request.fileName}
                        </td>
                        <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                          <span style={{
                            backgroundColor: '#f1f5f9',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px'
                          }}>
                            {request.fileCategory}
                          </span>
                        </td>
                        <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                          {request.clientName}
                        </td>
                        <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                          {request.requestedBy}
                        </td>
                        <td style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>
                          {new Date(request.requestedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '16px' }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: 
                              request.status === 'pending' ? '#fef3c7' :
                              request.status === 'approved' ? '#d1fae5' : '#fecaca',
                            color: 
                              request.status === 'pending' ? '#92400e' :
                              request.status === 'approved' ? '#065f46' : '#991b1b'
                          }}>
                            {request.status === 'pending' && '⏳ '}
                            {request.status === 'approved' && '✓ '}
                            {request.status === 'rejected' && '✗ '}
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </td>
                        <td style={{ padding: '16px' }}>
                          {request.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleApproveRecovery(request.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                                title="Approve Recovery"
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => handleRejectRecovery(request.id)}
                                style={{
                                  padding: '6px 12px',
                                  background: '#ef4444',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '12px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                                title="Reject Recovery"
                              >
                                ✗ Reject
                              </button>
                            </div>
                          ) : (
                            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                              {request.reviewedBy && (
                                <div>
                                  <div>By: {request.reviewedBy}</div>
                                  {request.reviewedAt && (
                                    <div style={{ fontSize: '11px', marginTop: '2px' }}>
                                      {new Date(request.reviewedAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '16px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{
              margin: '0 0 16px 0',
              fontSize: '20px',
              fontWeight: '700',
              color: '#1e293b'
            }}>
              Delete User?
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              color: '#64748b',
              fontSize: '14px'
            }}>
              Are you sure you want to delete <strong>{showDeleteConfirm.fullName}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#f1f5f9',
                  color: '#475569',
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
                onClick={() => handleDeleteUser(showDeleteConfirm.email)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
