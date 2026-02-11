import React, { useState, useEffect } from 'react';
import { FileRecoveryService, type FileRecoveryRequest } from '../services/fileRecoveryService';
import { ClientRecoveryService, type ClientRecoveryRequest } from '../services/clientRecoveryService';
import { showSuccessToast, showErrorToast, showConfirmDialog } from '../utils/toast';
import { VERSION_INFO, getFullVersion, getSecurityVersion, getBuildInfo } from '../config/version';
import WorkflowBuilder from './WorkflowBuilder';
import SystemMonitoring from './SystemMonitoring';
import TerritoryManager from './TerritoryManager';

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
  const [activeTab, setActiveTab] = useState<'users' | 'file-recovery' | 'client-recovery' | 'version' | 'workflows' | 'monitoring' | 'territory'>('users');
  const [recoveryRequests, setRecoveryRequests] = useState<FileRecoveryRequest[]>([]);
  const [clientRecoveryRequests, setClientRecoveryRequests] = useState<ClientRecoveryRequest[]>([]);
  const [filterRecoveryStatus, setFilterRecoveryStatus] = useState<string>('pending');
  const [filterClientRecoveryStatus, setFilterClientRecoveryStatus] = useState<string>('pending');
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [showSystemMonitoring, setShowSystemMonitoring] = useState(false);

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
    loadClientRecoveryRequests();
  }, []);

  const loadUsers = () => {
    const usersData = localStorage.getItem('crm_users');
    if (usersData) {
      try {
        const parsedUsers = JSON.parse(usersData);
        // console.log('📋 AdminPanel loaded users:', parsedUsers.length);
        // console.log('Users:', parsedUsers.map((u: User) => ({ email: u.email, verified: u.isVerified, role: u.role })));
        setUsers(parsedUsers);
      } catch (error) {
        // console.error('Error loading users:', error);
      }
    } else {
      // console.warn('⚠️ No users found in localStorage');
    }
  };

  const loadRecoveryRequests = () => {
    const requests = FileRecoveryService.getAllRequests();
    setRecoveryRequests(requests);
  };

  const loadClientRecoveryRequests = () => {
    const requests = ClientRecoveryService.getAllRequests();
    setClientRecoveryRequests(requests);
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
    showSuccessToast('User verified successfully!');
  };

  const handleChangeRole = (email: string, newRole: string) => {
    const updatedUsers = users.map(user => {
      if (user.email === email) {
        return { ...user, role: newRole };
      }
      return user;
    });
    saveUsers(updatedUsers);
    showSuccessToast(`User role changed to ${newRole}`);
  };

  const handleDeleteUser = (email: string) => {
    const updatedUsers = users.filter(user => user.email !== email);
    saveUsers(updatedUsers);
    setShowDeleteConfirm(null);
    showSuccessToast('User deleted successfully!');
  };

  const handleApproveRecovery = async (requestId: string) => {
    const request = recoveryRequests.find(r => r.id === requestId);
    if (!request) return;

    const confirmed = await showConfirmDialog(
      'Approve File Recovery',
      `Approve file recovery for "${request.fileName}"?`,
      'warning'
    );
    if (confirmed) {
      const success = FileRecoveryService.approveRequest(requestId, getCurrentAdmin());
      if (success) {
        showSuccessToast('File recovery approved successfully!');
        loadRecoveryRequests();
      } else {
        showErrorToast('Failed to approve recovery request.');
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
        showSuccessToast('File recovery request rejected.');
        loadRecoveryRequests();
      } else {
        showErrorToast('Failed to reject recovery request.');
      }
    }
  };

  const handleApproveClientRecovery = async (requestId: string) => {
    const request = clientRecoveryRequests.find(r => r.id === requestId);
    if (!request) return;

    const confirmed = await showConfirmDialog(
      'Approve Client Recovery',
      `Approve client recovery for "${request.clientName}"?`,
      'warning'
    );
    if (confirmed) {
      const success = await ClientRecoveryService.approveRequest(requestId, getCurrentAdmin());
      if (success) {
        showSuccessToast('Client recovery approved successfully!');
        loadClientRecoveryRequests();
      } else {
        showErrorToast('Failed to approve client recovery request.');
      }
    }
  };

  const handleRejectClientRecovery = (requestId: string) => {
    const request = clientRecoveryRequests.find(r => r.id === requestId);
    if (!request) return;

    const reason = prompt('Enter rejection reason (optional):');
    if (reason !== null) { // User didn't cancel
      const success = ClientRecoveryService.rejectRequest(requestId, getCurrentAdmin(), reason || undefined);
      if (success) {
        showSuccessToast('Client recovery request rejected.');
        loadClientRecoveryRequests();
      } else {
        showErrorToast('Failed to reject client recovery request.');
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

  const filteredClientRecoveryRequests = clientRecoveryRequests.filter(request => {
    if (filterClientRecoveryStatus === 'all') return true;
    return request.status === filterClientRecoveryStatus;
  });

  const recoveryStats = FileRecoveryService.getStatistics();
  const clientRecoveryStats = ClientRecoveryService.getStatistics();

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
            {activeTab === 'users' ? '👥 User Management' : activeTab === 'file-recovery' ? '📁 File Recovery Requests' : activeTab === 'client-recovery' ? '👤 Client Recovery Requests' : 'ℹ️ Version & System Info'}
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#64748b',
            margin: 0
          }}>
            {activeTab === 'users' 
              ? 'Manage user accounts, roles, and permissions' 
              : activeTab === 'file-recovery'
              ? 'Review and approve file recovery requests'
              : 'Review and approve client recovery requests'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => {
              loadUsers();
              loadRecoveryRequests();
              loadClientRecoveryRequests();
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
          onClick={() => setActiveTab('client-recovery')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'client-recovery' ? 'white' : 'transparent',
            color: activeTab === 'client-recovery' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'client-recovery' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            position: 'relative'
          }}
        >
          👤 Client Recovery
          {clientRecoveryStats.pending > 0 && (
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
              {clientRecoveryStats.pending}
            </span>
          )}
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
        <button
          onClick={() => setActiveTab('version')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'version' ? 'white' : 'transparent',
            color: activeTab === 'version' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'version' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          ℹ️ Version Info
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'workflows' ? 'white' : 'transparent',
            color: activeTab === 'workflows' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'workflows' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          🔄 Workflows
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'monitoring' ? 'white' : 'transparent',
            color: activeTab === 'monitoring' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'monitoring' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          🔍 System Monitoring
        </button>
        <button
          onClick={() => setActiveTab('territory')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'territory' ? 'white' : 'transparent',
            color: activeTab === 'territory' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'territory' ? '3px solid #3b82f6' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          🗺️ Territory Management
        </button>
      </div>

      {/* Version Info Tab */}
      {activeTab === 'version' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {/* Website Version */}
            <div style={{ borderRadius: '12px', padding: '20px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#1e293b', fontSize: '16px', fontWeight: '700' }}>📱 Website Version</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>VERSION</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#3b82f6' }}>{getFullVersion()}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>BUILD INFO</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569', fontFamily: 'monospace' }}>{getBuildInfo()}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#64748b', fontSize: '12px', fontWeight: '600' }}>BUILD DATE</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                    {new Date(VERSION_INFO.website.buildDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
              </div>
            </div>

            {/* Security Patch Version */}
            <div style={{ borderRadius: '12px', padding: '20px', background: '#f0fdf4', border: '1px solid #dcfce7' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#166534', fontSize: '16px', fontWeight: '700' }}>🔒 Security Patch Version</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#65a30d', fontSize: '12px', fontWeight: '600' }}>PATCH VERSION</p>
                  <p style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>v{getSecurityVersion()}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#65a30d', fontSize: '12px', fontWeight: '600' }}>LAST PATCHED</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                    {new Date(VERSION_INFO.security.lastPatched).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '0 0 4px 0', color: '#65a30d', fontSize: '12px', fontWeight: '600' }}>CRITICAL PATCHES</p>
                  <p style={{ margin: 0, fontSize: '13px', color: '#15803d', fontWeight: '600' }}>
                    {VERSION_INFO.security.criticalPatches} Applied
                  </p>
                </div>
              </div>
            </div>

            {/* Dependencies */}
            <div style={{ borderRadius: '12px', padding: '20px', background: '#faf5ff', border: '1px solid #f3e8ff' }}>
              <h3 style={{ margin: '0 0 16px 0', color: '#6b21a8', fontSize: '16px', fontWeight: '700' }}>📦 Key Dependencies</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #e9d5ff' }}>
                  <span style={{ color: '#64748b' }}>React</span>
                  <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: '600' }}>{VERSION_INFO.dependencies.react}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #e9d5ff' }}>
                  <span style={{ color: '#64748b' }}>TypeScript</span>
                  <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: '600' }}>{VERSION_INFO.dependencies.typescript}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid #e9d5ff' }}>
                  <span style={{ color: '#64748b' }}>Vite</span>
                  <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: '600' }}>{VERSION_INFO.dependencies.vite}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#64748b' }}>MongoDB</span>
                  <span style={{ fontFamily: 'monospace', color: '#7c3aed', fontWeight: '600' }}>{VERSION_INFO.dependencies.mongodb}</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div style={{ marginTop: '24px', borderRadius: '12px', padding: '20px', background: '#f0f9ff', border: '1px solid #e0f2fe' }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#0c4a6e', fontSize: '16px', fontWeight: '700' }}>⚙️ System Status</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%' }}></span>
                <span style={{ color: '#0c4a6e', fontSize: '13px', fontWeight: '600' }}>API Online</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%' }}></span>
                <span style={{ color: '#0c4a6e', fontSize: '13px', fontWeight: '600' }}>Database Connected</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#10b981', borderRadius: '50%' }}></span>
                <span style={{ color: '#0c4a6e', fontSize: '13px', fontWeight: '600' }}>Security Active</span>
              </div>
            </div>
          </div>

          {/* Version History Note */}
          <div style={{ marginTop: '24px', padding: '16px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '8px' }}>
            <p style={{ margin: 0, color: '#92400e', fontSize: '13px' }}>
              <strong>Note:</strong> Version information is automatically updated on each deployment. For detailed changelog, refer to the project documentation.
            </p>
          </div>
        </div>
      )}

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

      {/* Client Recovery Tab */}
      {activeTab === 'client-recovery' && (
        <>
          {/* Client Recovery Stats Cards */}
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
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#1e293b' }}>{clientRecoveryStats.total}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Pending</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>{clientRecoveryStats.pending}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Approved</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#10b981' }}>{clientRecoveryStats.approved}</p>
            </div>
            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Rejected</p>
              <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#ef4444' }}>{clientRecoveryStats.rejected}</p>
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
              value={filterClientRecoveryStatus}
              onChange={(e) => setFilterClientRecoveryStatus(e.target.value)}
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

          {/* Client Recovery Requests Table */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            {filteredClientRecoveryRequests.length === 0 ? (
              <div style={{
                padding: '48px',
                textAlign: 'center',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📭</div>
                <p style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0' }}>No client recovery requests</p>
                <p style={{ fontSize: '14px', margin: 0 }}>
                  {filterClientRecoveryStatus === 'pending' 
                    ? 'No pending client recovery requests at this time'
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
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Client Name</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Client No.</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Requested By</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Requested At</th>
                      <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Status</th>
                      <th style={{ padding: '16px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClientRecoveryRequests.map((request) => (
                      <tr key={request.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '16px', color: '#1e293b', fontSize: '14px', fontWeight: '500' }}>
                          👤 {request.clientName}
                        </td>
                        <td style={{ padding: '16px', color: '#64748b', fontSize: '14px' }}>
                          {request.clientNo || 'N/A'}
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
                                onClick={() => handleApproveClientRecovery(request.id)}
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
                                onClick={() => handleRejectClientRecovery(request.id)}
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

      {/* Workflows Tab */}
      {activeTab === 'workflows' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '700', color: '#1e293b' }}>
                🔄 Workflow Automation
              </h2>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>
                Automate repetitive tasks and save time with powerful workflows
              </p>
            </div>
            <button
              onClick={() => setShowWorkflowBuilder(true)}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: '0 4px 6px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Open Workflow Builder
            </button>
          </div>

          {/* Feature Overview */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ padding: '20px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚡</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#1e40af' }}>Automated Actions</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>
                Trigger automatic emails, notifications, tasks, and more based on events
              </p>
            </div>
            
            <div style={{ padding: '20px', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎯</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#166534' }}>Smart Triggers</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: '1.5' }}>
                Start workflows when clients are created, statuses change, or on schedule
              </p>
            </div>
            
            <div style={{ padding: '20px', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde047' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#854d0e' }}>Ready Templates</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#854d0e', lineHeight: '1.5' }}>
                5+ pre-built workflow templates to get started immediately
              </p>
            </div>
            
            <div style={{ padding: '20px', background: '#fce7f3', borderRadius: '12px', border: '1px solid #fbcfe8' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔀</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: '600', color: '#9f1239' }}>Conditional Logic</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#9f1239', lineHeight: '1.5' }}>
                Create complex workflows with if-this-then-that conditions
              </p>
            </div>
          </div>

          {/* Common Use Cases */}
          <div style={{ marginTop: '32px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '600', color: '#1e293b' }}>Common Use Cases</h3>
            <div style={{ display: 'grid', gap: '12px' }}>
              {[
                { icon: '👋', title: 'Welcome New Clients', desc: 'Automatically send welcome emails when clients are added' },
                { icon: '📅', title: 'Follow-up Reminders', desc: 'Create tasks to follow up with clients after 3 days' },
                { icon: '🔔', title: 'Status Notifications', desc: 'Notify team when client status changes' },
                { icon: '⏰', title: 'Inactivity Alerts', desc: 'Alert team about clients inactive for 30+ days' },
                { icon: '👥', title: 'Auto-Assignment', desc: 'Automatically assign new clients to available team members' },
                { icon: '📊', title: 'Daily Reports', desc: 'Send automated daily summary reports' }
              ].map((useCase, index) => (
                <div key={index} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: '28px' }}>{useCase.icon}</div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                      {useCase.title}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      {useCase.desc}
                    </p>
                  </div>
                  <div style={{
                    padding: '6px 12px',
                    background: '#e0e7ff',
                    color: '#4338ca',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>
                    AVAILABLE
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            marginTop: '32px',
            padding: '24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'white'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '700' }}>
              Ready to Automate Your Workflow?
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '14px', opacity: 0.9 }}>
              Open the Workflow Builder to create your first automation in minutes
            </p>
            <button
              onClick={() => setShowWorkflowBuilder(true)}
              style={{
                padding: '14px 32px',
                background: 'white',
                color: '#667eea',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                cursor: 'pointer',
                fontSize: '15px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              }}
            >
              🚀 Launch Workflow Builder
            </button>
          </div>
        </div>
      )}

      {/* System Monitoring Tab */}
      {activeTab === 'monitoring' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ 
            textAlign: 'center', 
            maxWidth: '800px', 
            margin: '0 auto',
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            borderRadius: '16px',
            padding: '48px 32px',
            color: 'white',
            boxShadow: '0 8px 32px rgba(239, 68, 68, 0.3)'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔍</div>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '32px', fontWeight: '800' }}>
              System Monitoring & Error Detection
            </h2>
            <p style={{ 
              margin: '0 0 32px 0', 
              fontSize: '16px', 
              opacity: 0.95,
              lineHeight: '1.6'
            }}>
              Real-time monitoring, automatic error detection, and comprehensive system health analysis
            </p>

            {/* Feature Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '16px',
              marginBottom: '32px',
              textAlign: 'left'
            }}>
              <div style={{ 
                background: 'rgba(255,255,255,0.15)', 
                padding: '16px', 
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>❌</div>
                <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Error Tracking</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  Automatic capture of JavaScript errors, API failures, and exceptions
                </div>
              </div>
              <div style={{ 
                background: 'rgba(255,255,255,0.15)', 
                padding: '16px', 
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚡</div>
                <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Performance Monitoring</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  Track page load times, API response times, and memory usage
                </div>
              </div>
              <div style={{ 
                background: 'rgba(255,255,255,0.15)', 
                padding: '16px', 
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚨</div>
                <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Anomaly Detection</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  AI-powered detection of unusual patterns and suspicious activity
                </div>
              </div>
              <div style={{ 
                background: 'rgba(255,255,255,0.15)', 
                padding: '16px', 
                borderRadius: '12px',
                backdropFilter: 'blur(10px)'
              }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔄</div>
                <div style={{ fontWeight: '700', marginBottom: '4px', fontSize: '15px' }}>Data Consistency</div>
                <div style={{ fontSize: '13px', opacity: 0.9 }}>
                  Automatic checks for duplicates, orphaned data, and validation issues
                </div>
              </div>
            </div>

            {/* Key Capabilities */}
            <div style={{ 
              background: 'rgba(255,255,255,0.1)', 
              padding: '24px', 
              borderRadius: '12px',
              marginBottom: '32px',
              backdropFilter: 'blur(10px)'
            }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>
                What Gets Monitored
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div>✓ JavaScript Errors</div>
                <div>✓ API Failures</div>
                <div>✓ Network Issues</div>
                <div>✓ Performance Degradation</div>
                <div>✓ Memory Leaks</div>
                <div>✓ Slow Responses</div>
                <div>✓ Duplicate Records</div>
                <div>✓ Data Corruption</div>
                <div>✓ Validation Failures</div>
              </div>
            </div>

            <button
              onClick={() => setShowSystemMonitoring(true)}
              style={{
                padding: '16px 40px',
                background: 'white',
                color: '#ef4444',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '16px',
                boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-3px)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.2)';
              }}
            >
              🚀 Open System Monitor
            </button>
          </div>
        </div>
      )}

      {/* Territory Management Tab */}
      {activeTab === 'territory' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', height: '80vh', overflow: 'hidden' }}>
          <TerritoryManager onClose={() => setActiveTab('users')} />
        </div>
      )}

      {/* Workflow Builder Modal */}
      {showWorkflowBuilder && (
        <WorkflowBuilder onClose={() => setShowWorkflowBuilder(false)} />
      )}

      {/* System Monitoring Modal */}
      {showSystemMonitoring && (
        <SystemMonitoring onClose={() => setShowSystemMonitoring(false)} />
      )}
    </div>
  );
};

export default AdminPanel;
