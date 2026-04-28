import React, { useState, useEffect } from 'react';
import { validateRoleChange, sanitizeEmail } from '../utils/formSanitizer';
import { MongoDBService } from '../services/mongoDBService';
import { FileRecoveryService, type FileRecoveryRequest } from '../services/fileRecoveryService';
import { ClientRecoveryService, type ClientRecoveryRequest } from '../services/clientRecoveryService';
import { showSuccessToast, showErrorToast, showConfirmDialog } from '../utils/toast';
import { authHeaders } from '../utils/authToken';
import { VERSION_INFO, getFullVersion, getSecurityVersion, getBuildInfo } from '../config/version';
import { FileService } from '../services/fileService';
import { getPackageOptions, savePackageOptions, getClientPackages } from './PackageSelect';
import WorkflowBuilder from './WorkflowBuilder';
import SystemMonitoring from './SystemMonitoring';
import TerritoryManager from './TerritoryManager';
import StressTest from './StressTest';

interface User {
  fullName: string;
  username: string;
  email: string;
  password: string;
  department: string;
  position: string;
  profileImage?: string;
  registeredAt: string;
  createdAt?: string;
  isVerified: boolean;
  verificationToken?: string | null;
  verificationTokenExpiry?: number | null;
  verifiedAt?: string;
  role?: string;
  registrationMethod?: 'auth0' | 'manual';
  approvalStatus?: 'pending' | 'approved' | 'rejected';
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
  const [activeTab, setActiveTab] = useState<'users' | 'file-recovery' | 'client-recovery' | 'version' | 'workflows' | 'monitoring' | 'territory' | 'stress-test' | 'branding' | 'storage-quota' | 'backup-restore' | 'packages'>('users');
  const [packageOptions, setPackageOptions] = useState<string[]>(() => getPackageOptions());
  const [newPackageInput, setNewPackageInput] = useState('');
  const [packageEditIdx, setPackageEditIdx] = useState<number | null>(null);
  const [packageEditValue, setPackageEditValue] = useState('');
  const [backupStatus, setBackupStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [r2BackupStatus, setR2BackupStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [r2BackupList, setR2BackupList] = useState<Array<{ date: string; files: Array<{ name: string; size: number; lastModified: string; key: string }>; totalSize: number }> | null>(null);
  const [r2BackupListLoading, setR2BackupListLoading] = useState(false);
  const [r2BackupListError, setR2BackupListError] = useState('');
  const [r2SelectedDate, setR2SelectedDate] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [backupProgress, setBackupProgress] = useState<number | null>(null);
  const [r2BackupProgress, setR2BackupProgress] = useState<number | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<number | null>(null);
  const [r2FilesDownloadStatus, setR2FilesDownloadStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' });
  const [zipProgress, setZipProgress] = useState<number | null>(null);
  const [restorePreview, setRestorePreview] = useState<{ createdAt: string; createdBy: string; collections: string[]; localKeys: string[] } | null>(null);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [recoveryRequests, setRecoveryRequests] = useState<FileRecoveryRequest[]>([]);
  const [clientRecoveryRequests, setClientRecoveryRequests] = useState<ClientRecoveryRequest[]>([]);
  const [filterRecoveryStatus, setFilterRecoveryStatus] = useState<string>('pending');
  const [filterClientRecoveryStatus, setFilterClientRecoveryStatus] = useState<string>('pending');
  const [showWorkflowBuilder, setShowWorkflowBuilder] = useState(false);
  const [showSystemMonitoring, setShowSystemMonitoring] = useState(false);
  const [companyLogo, setCompanyLogo] = useState<string>(localStorage.getItem('crm_company_logo') || '');
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Quota settings: { defaultLimit: number, perUser: { [email]: number } }
  const [quotaSettings, setQuotaSettings] = useState<{ defaultLimit: number; perUser: Record<string, number> }>(() => {
    try {
      const raw = localStorage.getItem('crm_quota_settings');
      return raw ? JSON.parse(raw) : { defaultLimit: 100, perUser: {} };
    } catch { return { defaultLimit: 100, perUser: {} }; }
  });
  const [quotaEditValues, setQuotaEditValues] = useState<Record<string, string>>({});

  const saveQuotaSettings = (updated: typeof quotaSettings) => {
    setQuotaSettings(updated);
    localStorage.setItem('crm_quota_settings', JSON.stringify(updated));
  };

  // localStorage usage helpers
  const getStorageUsage = () => {
    const MAX_BYTES = 5 * 1024 * 1024; // 5 MB browser limit
    const keys: { key: string; label: string; bytes: number }[] = [];
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const val = localStorage.getItem(key) || '';
      const bytes = new Blob([val]).size;
      total += bytes;
      keys.push({ key, label: key, bytes });
    }
    keys.sort((a, b) => b.bytes - a.bytes);
    return { keys, total, maxBytes: MAX_BYTES };
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Count active (non-deleted, non-test) clients per user.
  // The `agent` field is free-text entered by employees so we try multiple
  // identifiers: fullName, username, email local-part, and first name.
  const getClientCountForUser = (user: User): number => {
    try {
      const raw = localStorage.getItem('crm_clients_data');
      const all: any[] = raw ? JSON.parse(raw) : [];

      // Build a set of lower-case identifiers for this user
      const ids = new Set<string>();
      if (user.fullName) ids.add(user.fullName.trim().toLowerCase());
      if (user.username) ids.add(user.username.trim().toLowerCase());
      if (user.email) {
        ids.add(user.email.trim().toLowerCase());
        // email local-part (before @)
        const localPart = user.email.split('@')[0].trim().toLowerCase();
        if (localPart) ids.add(localPart);
      }
      // first name only (first word of fullName)
      if (user.fullName) {
        const firstName = user.fullName.trim().split(/\s+/)[0].toLowerCase();
        if (firstName.length > 2) ids.add(firstName);
      }

      return all.filter(c => {
        if (c.isDeleted || c.isTestRecord) return false;
        const agentVal = (c.agent || '').trim().toLowerCase();
        if (!agentVal) return false;
        // exact match on any identifier
        if (ids.has(agentVal)) return true;
        // partial: agent field contains fullName or vice-versa
        if (user.fullName && agentVal.includes(user.fullName.trim().toLowerCase())) return true;
        if (user.fullName && user.fullName.trim().toLowerCase().includes(agentVal)) return true;
        return false;
      }).length;
    } catch { return 0; }
  };

  // Count clients with no agent assigned (unassigned)
  const getUnassignedClientCount = (): number => {
    try {
      const raw = localStorage.getItem('crm_clients_data');
      const all: any[] = raw ? JSON.parse(raw) : [];
      return all.filter(c => !c.isDeleted && !c.isTestRecord && !(c.agent || '').trim()).length;
    } catch { return 0; }
  };

  // Get current admin user from localStorage
  const getCurrentAdmin = (): string => {
    const currentUserData = localStorage.getItem('crm_current_user');
    if (currentUserData) {
      try {
        const userData = JSON.parse(currentUserData);
        return userData.fullName || userData.username || 'Admin';
      } catch {
        return 'Admin';
      }
    }
    return 'Admin';
  };

  useEffect(() => {
    loadUsers();
    loadRecoveryRequests();
    loadClientRecoveryRequests();
  }, []);

  const loadUsers = async () => {
    // First load from localStorage immediately (offline fallback)
    const usersData = localStorage.getItem('crm_users');
    if (usersData) {
      try {
        const parsedUsers = JSON.parse(usersData);
        setUsers(parsedUsers);
      } catch {
        // ignore parse errors
      }
    }
    // Then fetch all users from MongoDB (includes Auth0 users not in localStorage)
    try {
      const res = await fetch('/.netlify/functions/get-users', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
          // Keep localStorage in sync so mention autocomplete works
          localStorage.setItem('crm_users', JSON.stringify(data.users));
        }
      }
    } catch {
      // Network error — already showing localStorage data
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
    // Persist verification to MongoDB
    MongoDBService.updateUser(email, {
      isVerified: true,
      verificationToken: null,
      verificationTokenExpiry: null,
      verifiedAt: new Date().toISOString()
    }).catch(() => { /* non-critical */ });
    showSuccessToast('User verified successfully!');
  };

  const handleApproveUser = async (email: string, action: 'approve' | 'reject') => {
    const confirmed = await showConfirmDialog(
      action === 'approve' ? 'Approve User' : 'Reject User',
      action === 'approve'
        ? 'This will allow the user to access the CRM. Continue?'
        : 'This will prevent the user from accessing the CRM. Continue?',
      action === 'approve' ? 'info' : 'warning'
    );
    if (!confirmed) return;

    try {
      const res = await fetch('/.netlify/functions/approve-user', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, action })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedUsers = users.map(user => {
          if (user.email === email) {
            return { ...user, approvalStatus: action === 'approve' ? 'approved' as const : 'rejected' as const };
          }
          return user;
        });
        saveUsers(updatedUsers);
        showSuccessToast(`User ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
      } else {
        showErrorToast(data.error || `Failed to ${action} user`);
      }
    } catch {
      showErrorToast(`Could not reach server to ${action} user`);
    }
  };

  const handleChangeRole = (email: string, newRole: string) => {
    const cleanEmail = sanitizeEmail(email);
    const validation = validateRoleChange({ email: cleanEmail, newRole });
    if (!validation.valid) {
      return; // silently ignore invalid role values (they come from a controlled <select>)
    }
    const updatedUsers = users.map(user => {
      if (user.email === cleanEmail) {
        return { ...user, role: newRole };
      }
      return user;
    });
    saveUsers(updatedUsers);
    // Persist role change to MongoDB
    MongoDBService.updateUser(cleanEmail, { role: newRole }).catch(() => { /* non-critical */ });
    showSuccessToast(`User role changed to ${newRole}`);
  };

  const handleDeleteUser = async (email: string) => {
    const updatedUsers = users.filter(user => user.email !== email);
    saveUsers(updatedUsers);
    // Invalidate client cache so next load reflects any reassignments
    localStorage.removeItem('crm_clients_last_sync');
    // Delete from MongoDB via dedicated admin endpoint
    try {
      const res = await fetch('/.netlify/functions/delete-user', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        showErrorToast(data.error || 'Failed to delete user from database');
      }
    } catch {
      showErrorToast('Could not reach server to delete user');
    }
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showErrorToast('Please upload an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showErrorToast('Logo must be under 2 MB.');
      return;
    }
    setIsUploadingLogo(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      localStorage.setItem('crm_company_logo', dataUrl);
      setCompanyLogo(dataUrl);
      setIsUploadingLogo(false);
      showSuccessToast('Company logo updated! It will appear in the navbar and sidebar.');
    };
    reader.onerror = () => {
      setIsUploadingLogo(false);
      showErrorToast('Failed to read the image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    localStorage.removeItem('crm_company_logo');
    setCompanyLogo('');
    showSuccessToast('Company logo removed. Default logo will be used.');
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
        <button
          onClick={() => setActiveTab('stress-test')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'stress-test' ? 'white' : 'transparent',
            color: activeTab === 'stress-test' ? '#3b82f6' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'stress-test' ? '3px solid #28A2DC' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px'
          }}
        >
          🧪 Stress Test
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'branding' ? 'white' : 'transparent',
            color: activeTab === 'branding' ? '#0A2D74' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'branding' ? '3px solid #28A2DC' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          🎨 Branding
        </button>
        <button
          onClick={() => setActiveTab('storage-quota')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'storage-quota' ? 'white' : 'transparent',
            color: activeTab === 'storage-quota' ? '#7c3aed' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'storage-quota' ? '3px solid #7c3aed' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          💾 Storage &amp; Quota
        </button>
        <button
          onClick={() => setActiveTab('backup-restore')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'backup-restore' ? 'white' : 'transparent',
            color: activeTab === 'backup-restore' ? '#059669' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'backup-restore' ? '3px solid #059669' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          🗄️ Backup &amp; Restore
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'packages' ? 'white' : 'transparent',
            color: activeTab === 'packages' ? '#0891b2' : '#64748b',
            border: 'none',
            borderBottom: activeTab === 'packages' ? '3px solid #0891b2' : '3px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            marginBottom: '-2px',
            whiteSpace: 'nowrap'
          }}
        >
          📦 Packages
        </button>
      </div>

      {/* Branding Tab */}
      {activeTab === 'branding' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '32px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: '#0A2D74' }}>Company Branding</h2>
          <p style={{ margin: '0 0 28px 0', color: '#64748b', fontSize: '14px' }}>
            Customize your company logo. It will appear in the navigation bar and sidebar throughout the app.
          </p>

          {/* Current Logo Preview */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: '#0A2D74', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Current Logo
            </p>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '20px',
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #071f55 0%, #0A2D74 60%, #28A2DC 100%)',
              borderRadius: '12px',
              boxShadow: '0 4px 16px rgba(10,45,116,0.25)'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '12px',
                border: '2px solid rgba(40,162,220,0.6)',
                background: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '3px'
              }}>
                <img
                  src={companyLogo || '/DG.jpg'}
                  alt="Company Logo Preview"
                  onError={(e) => { e.currentTarget.src = '/DG.jpg'; }}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#fff', letterSpacing: '0.08em', fontFamily: "'LemonMilk', 'Inter', sans-serif" }}>
                  DG-CRM
                </div>
                <div style={{ fontSize: '10px', color: '#28A2DC', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  Discover Group
                </div>
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Preview of how the logo appears in the navbar
            </p>
          </div>

          {/* Upload Section */}
          <div style={{
            border: '2px dashed rgba(40,162,220,0.4)',
            borderRadius: '12px',
            padding: '32px',
            textAlign: 'center',
            background: 'rgba(40,162,220,0.03)',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🖼️</div>
            <p style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '600', color: '#0A2D74' }}>
              Upload Company Logo
            </p>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
              PNG, JPG, SVG or WebP · Maximum 2 MB · Recommended: 200×200px or square format
            </p>
            <label style={{
              display: 'inline-block',
              padding: '10px 28px',
              background: 'linear-gradient(135deg, #0A2D74 0%, #28A2DC 100%)',
              color: 'white',
              borderRadius: '8px',
              cursor: isUploadingLogo ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(10,45,116,0.3)',
              opacity: isUploadingLogo ? 0.7 : 1,
              transition: 'all 0.2s ease'
            }}>
              {isUploadingLogo ? '⏳ Uploading...' : '📁 Choose Logo File'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                disabled={isUploadingLogo}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          {/* Remove Logo Button */}
          {companyLogo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa' }}>
              <span style={{ fontSize: '20px' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#c2410c' }}>Custom logo is active</p>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9a3412' }}>Remove it to revert to the default Discover Group logo.</p>
              </div>
              <button
                onClick={handleRemoveLogo}
                style={{
                  padding: '8px 16px',
                  background: 'transparent',
                  color: '#dc2626',
                  border: '1.5px solid #dc2626',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  whiteSpace: 'nowrap'
                }}
              >
                Remove Logo
              </button>
            </div>
          )}

          {/* Brand Color Reference */}
          <div style={{ marginTop: '32px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '600', color: '#0A2D74', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Brand Color Palette
            </p>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {[
                { color: '#0A2D74', name: 'Primary Navy', hex: '#0A2D74' },
                { color: '#28A2DC', name: 'Sky Blue', hex: '#28A2DC' },
                { color: '#ffffff', name: 'White', hex: '#FFFFFF', border: '#e2e8f0' }
              ].map(({ color, name, hex, border }) => (
                <div key={hex} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    background: color,
                    border: `2px solid ${border || color}`,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                  }} />
                  <div>
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{name}</p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', fontFamily: 'monospace' }}>{hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stress Test Tab */}
      {activeTab === 'stress-test' && (
        <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <StressTest onClose={() => setActiveTab('users')} />
        </div>
      )}

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
        <div style={{
          background: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '14px' }}>Interns</p>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
            {users.filter(u => u.role === 'intern').length}
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
            <option value="intern">Intern</option>
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
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Approval</th>
                <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase' }}>Registration</th>
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
                        background: user.role === 'admin' ? '#dbeafe' : user.role === 'intern' ? '#fef3c7' : '#f1f5f9',
                        color: user.role === 'admin' ? '#1e40af' : user.role === 'intern' ? '#92400e' : '#475569',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="intern">Intern</option>
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
                  <td style={{ padding: '16px' }}>
                    {(() => {
                      const status = user.approvalStatus || 'pending';
                      const styles: Record<string, { bg: string; color: string; label: string }> = {
                        approved: { bg: '#d1fae5', color: '#065f46', label: '✓ Approved' },
                        pending: { bg: '#fef3c7', color: '#92400e', label: '⏳ Pending' },
                        rejected: { bg: '#fee2e2', color: '#991b1b', label: '✕ Rejected' },
                      };
                      const s = styles[status] || styles.pending;
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontSize: '12px',
                            fontWeight: '600',
                            background: s.bg,
                            color: s.color,
                            display: 'inline-block',
                            width: 'fit-content'
                          }}>
                            {s.label}
                          </span>
                          {status !== 'approved' && (
                            <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
                              <button
                                onClick={() => handleApproveUser(user.email, 'approve')}
                                style={{
                                  padding: '3px 8px',
                                  background: '#10b981',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  fontWeight: '600',
                                  cursor: 'pointer'
                                }}
                              >
                                Approve
                              </button>
                              {status !== 'rejected' && (
                                <button
                                  onClick={() => handleApproveUser(user.email, 'reject')}
                                  style={{
                                    padding: '3px 8px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Reject
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {user.registrationMethod === 'auth0' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: '#dbeafe',
                        color: '#1e40af'
                      }}>
                        🔐 Auth0
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: '#f0fdf4',
                        color: '#166534'
                      }}>
                        📝 Manual
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: '#64748b', fontSize: '13px' }}>
                    {(() => {
                      const d = user.createdAt || user.registeredAt;
                      if (!d) return '—';
                      const parsed = new Date(d);
                      return isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString();
                    })()}
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

      {/* Storage & Quota Tab */}
      {activeTab === 'storage-quota' && (() => {
        const usage = getStorageUsage();
        const usedPct = Math.min(100, (usage.total / usage.maxBytes) * 100);
        const barColor = usedPct > 85 ? '#ef4444' : usedPct > 60 ? '#f59e0b' : '#10b981';
        const unassignedCount = getUnassignedClientCount();

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* ── LocalStorage Usage Overview ─────────────────────── */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>💾 LocalStorage Usage (This Device)</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>
                Each employee's browser has a shared 5 MB limit for this app. Data below reflects the currently logged-in device.
              </p>

              {/* Total bar */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Total Used</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: barColor }}>
                    {formatBytes(usage.total)} / {formatBytes(usage.maxBytes)} ({usedPct.toFixed(1)}%)
                  </span>
                </div>
                <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${usedPct}%`, background: barColor, borderRadius: '8px', transition: 'width 0.3s' }} />
                </div>
              </div>

              {/* Per-key breakdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {usage.keys.map(({ key, bytes }) => {
                  const pct = usage.total > 0 ? (bytes / usage.maxBytes) * 100 : 0;
                  const isCritical = key === 'crm_monitoring_data' || key === 'crm_activity_logs';
                  return (
                    <div key={key} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '10px', alignItems: 'center', padding: '8px 12px', background: isCritical ? '#fff7ed' : '#f8fafc', borderRadius: '8px', border: `1px solid ${isCritical ? '#fed7aa' : '#e2e8f0'}` }}>
                      <div>
                        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#1e293b', fontWeight: '600' }}>{key}</span>
                        {isCritical && <span style={{ marginLeft: '8px', fontSize: '10px', background: '#f59e0b', color: 'white', borderRadius: '4px', padding: '1px 6px', fontWeight: '600' }}>HEAVY</span>}
                        <div style={{ marginTop: '4px', height: '4px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, pct * (usage.maxBytes / bytes) * 0.01)}%`, maxWidth: `${Math.min(100, pct * 5)}%`, background: isCritical ? '#f59e0b' : '#3b82f6', borderRadius: '4px' }} />
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap' }}>{formatBytes(bytes)}</span>
                      <button
                        onClick={async () => {
                          const ok = await showConfirmDialog('Clear Key', `Remove "${key}" from localStorage? This may affect app data.`, 'warning');
                          if (ok) { localStorage.removeItem(key); showSuccessToast(`Cleared ${key}`); setQuotaSettings({ ...quotaSettings }); /* trigger re-render */ }
                        }}
                        style={{ padding: '3px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        Clear
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Quick cleanup button */}
              <button
                onClick={async () => {
                  const ok = await showConfirmDialog('Free Up Space', 'This will trim monitoring logs and activity logs to their minimum size to free up localStorage space. Client data will NOT be affected.', 'info');
                  if (!ok) return;
                  const monRaw = localStorage.getItem('crm_monitoring_data');
                  if (monRaw) { try { const d = JSON.parse(monRaw); localStorage.setItem('crm_monitoring_data', JSON.stringify({ errorLogs: (d.errorLogs||[]).slice(0,10), performanceMetrics: (d.performanceMetrics||[]).slice(0,10), anomalies: (d.anomalies||[]).slice(0,5), validationIssues: (d.validationIssues||[]).slice(0,5), consistencyChecks: (d.consistencyChecks||[]).slice(0,5) })); } catch { localStorage.removeItem('crm_monitoring_data'); } }
                  const logRaw = localStorage.getItem('crm_activity_logs');
                  if (logRaw) { try { const logs = JSON.parse(logRaw); localStorage.setItem('crm_activity_logs', JSON.stringify(Array.isArray(logs) ? logs.slice(0, 50) : [])); } catch { localStorage.removeItem('crm_activity_logs'); } }
                  showSuccessToast('Storage freed up successfully.');
                  setQuotaSettings({ ...quotaSettings }); // trigger re-render
                }}
                style={{ marginTop: '16px', padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
              >
                🧹 Free Up Space (Trim Logs)
              </button>

              {/* Remove embedded base64 file data */}
              {(() => {
                const b64Count = FileService.getBase64AttachmentCount();
                if (b64Count === 0) return null;
                return (
                  <button
                    onClick={async () => {
                      const ok = await showConfirmDialog(
                        'Remove Embedded File Data',
                        `${b64Count} file attachment(s) have their binary data embedded directly in localStorage instead of Cloudflare R2. This is leftover from upload failures.\n\nRemoving the embedded data will free significant space. The file metadata (name, date, client) is kept so the record is not lost, but the file itself will no longer be downloadable from this device.\n\nProceed?`,
                        'warning'
                      );
                      if (!ok) return;
                      const { freed, base64Count } = FileService.pruneBase64DataFromStorage();
                      showSuccessToast(`Removed embedded data from ${base64Count} file(s) — freed ~${Math.round(freed / 1024)} KB`);
                      setQuotaSettings({ ...quotaSettings }); // trigger re-render
                    }}
                    style={{ marginTop: '10px', marginLeft: '10px', padding: '10px 20px', background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.3)' }}
                  >
                    🗜️ Remove Embedded File Data ({b64Count} file{b64Count !== 1 ? 's' : ''})
                  </button>
                );
              })()}
            </div>

            {/* ── Per-Employee Client Quota ─────────────────────────── */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>👤 Per-Employee Client Quota</h2>
              <p style={{ margin: '0 0 8px 0', color: '#64748b', fontSize: '13px' }}>
                Set the maximum number of active clients each employee can manage. A warning is shown when they hit the limit. Default applies to all employees without a custom limit.
              </p>

              {/* Default limit */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '14px 18px', background: '#f8f4ff', borderRadius: '10px', border: '1px solid #e9d5ff' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#7c3aed', flex: 1 }}>🔒 Default Limit (all employees)</span>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={quotaEditValues['__default__'] ?? quotaSettings.defaultLimit}
                  onChange={e => setQuotaEditValues(v => ({ ...v, '__default__': e.target.value }))}
                  style={{ width: '80px', padding: '6px 10px', border: '1.5px solid #c4b5fd', borderRadius: '8px', fontSize: '14px', fontWeight: '700', color: '#7c3aed', textAlign: 'center' }}
                />
                <button
                  onClick={() => {
                    const val = parseInt(quotaEditValues['__default__'] || String(quotaSettings.defaultLimit));
                    if (!isNaN(val) && val > 0) {
                      saveQuotaSettings({ ...quotaSettings, defaultLimit: val });
                      setQuotaEditValues(v => { const n = { ...v }; delete n['__default__']; return n; });
                      showSuccessToast(`Default quota set to ${val} clients`);
                    }
                  }}
                  style={{ padding: '6px 16px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  Save
                </button>
              </div>

              {/* Per-user rows */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #0A2D74 0%, #1a4a9e 100%)' }}>
                    {['Employee', 'Email', 'Clients Used', 'Quota Limit', 'Usage', 'Action'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.role !== 'admin' && u.email !== 'admin@discovergrp.com').map((user, idx) => {
                    const used = getClientCountForUser(user);
                    const limit = quotaSettings.perUser[user.email] ?? quotaSettings.defaultLimit;
                    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                    const barC = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
                    const editKey = `user_${user.email}`;
                    return (
                      <tr key={user.email} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8faff', borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '12px 14px', fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{user.fullName || user.username}</td>
                        <td style={{ padding: '12px 14px', fontSize: '12px', color: '#64748b' }}>{user.email}</td>
                        <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: '700', color: barC }}>{used}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <input
                              type="number"
                              min={1}
                              max={9999}
                              value={quotaEditValues[editKey] ?? limit}
                              onChange={e => setQuotaEditValues(v => ({ ...v, [editKey]: e.target.value }))}
                              style={{ width: '70px', padding: '5px 8px', border: `1.5px solid ${quotaSettings.perUser[user.email] ? '#7c3aed' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px', fontWeight: '600', color: '#1e293b', textAlign: 'center' }}
                            />
                            {quotaSettings.perUser[user.email] && (
                              <span style={{ fontSize: '10px', background: '#7c3aed', color: 'white', borderRadius: '4px', padding: '1px 6px' }}>custom</span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px', minWidth: '120px' }}>
                          <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: barC, borderRadius: '6px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: barC, fontWeight: '600' }}>{pct.toFixed(0)}%</span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => {
                                const val = parseInt(quotaEditValues[editKey] || String(limit));
                                if (!isNaN(val) && val > 0) {
                                  const updated = { ...quotaSettings, perUser: { ...quotaSettings.perUser, [user.email]: val } };
                                  saveQuotaSettings(updated);
                                  setQuotaEditValues(v => { const n = { ...v }; delete n[editKey]; return n; });
                                  showSuccessToast(`Quota for ${user.fullName || user.email} set to ${val}`);
                                }
                              }}
                              style={{ padding: '5px 12px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            {quotaSettings.perUser[user.email] && (
                              <button
                                onClick={() => {
                                  const updated = { ...quotaSettings, perUser: { ...quotaSettings.perUser } };
                                  delete updated.perUser[user.email];
                                  saveQuotaSettings(updated);
                                  setQuotaEditValues(v => { const n = { ...v }; delete n[editKey]; return n; });
                                  showSuccessToast(`Reset to default quota for ${user.fullName || user.email}`);
                                }}
                                style={{ padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {/* Unassigned clients notice */}
              {unassignedCount > 0 && (
                <div style={{ marginTop: '12px', padding: '10px 16px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', fontSize: '13px', color: '#854d0e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>⚠️</span>
                  <span><strong>{unassignedCount}</strong> client{unassignedCount !== 1 ? 's' : ''} have no Sales Agent assigned — they are not counted in any employee's quota above.</span>
                </div>
              )}
              {users.filter(u => u.role !== 'admin' && u.email !== 'admin@discovergrp.com').length === 0 && (
                <p style={{ textAlign: 'center', color: '#94a3b8', padding: '20px' }}>No employees found.</p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Backup & Restore Tab */}
      {activeTab === 'backup-restore' && (() => {
        const DB_API = '/.netlify/functions/database';

        // Keys to include in localStorage backup (auth tokens excluded intentionally)
        const LS_BACKUP_KEYS = [
          'crm_clients_data',
          'crm_users',
          'crm_activity_logs',
          'crm_log_notes',
          'crm_payment_data',
          'crm_calendar_events',
          'crm_notifications',
          'crm_quota_settings',
          'crm_package_options',
          'crm_company_logo',
          'crm_file_attachments',
          'crm_branding',
        ];

        // MongoDB collections to back up (must match database.ts allowlist)
        const MONGO_COLLECTIONS = [
          'clients',
          'users',
          'activity_logs',
          'file_attachments',
          'log_notes',
          'calendar_events',
          'notifications',
        ];

        const handleBackup = async () => {
          setBackupStatus({ type: 'loading', message: 'Fetching data from MongoDB…' });
          setBackupProgress(0);
          try {
            // 1. Gather localStorage
            const localStorageData: Record<string, any> = {};
            for (const key of LS_BACKUP_KEYS) {
              const raw = localStorage.getItem(key);
              if (raw !== null) {
                try { localStorageData[key] = JSON.parse(raw); } catch { localStorageData[key] = raw; }
              }
            }

            // 2. Fetch all MongoDB collections IN PARALLEL
            setBackupProgress(10);
            const mongoEntries = await Promise.all(
              MONGO_COLLECTIONS.map(async (col) => {
                try {
                  const res = await fetch(DB_API, {
                    method: 'POST',
                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ collection: col, operation: 'find', filter: {} }),
                  });
                  const json = await res.json();
                  return [col, json.success && Array.isArray(json.data) ? json.data : []] as const;
                } catch {
                  return [col, []] as const;
                }
              })
            );
            const mongoData: Record<string, any[]> = Object.fromEntries(mongoEntries);
            setBackupProgress(85);

            // 3. Build backup object
            const backup = {
              _crmBackup: true,
              version: '1.0',
              createdAt: new Date().toISOString(),
              createdBy: getCurrentAdmin(),
              localStorage: localStorageData,
              mongodb: mongoData,
            };

            // 4. Trigger download
            const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dg-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);

            setBackupProgress(100);
            setBackupStatus({ type: 'success', message: `Backup downloaded successfully. Includes ${Object.keys(localStorageData).length} localStorage keys and ${MONGO_COLLECTIONS.length} MongoDB collections.` });
            setTimeout(() => setBackupProgress(null), 2000);
          } catch (err: any) {
            setBackupStatus({ type: 'error', message: `Backup failed: ${err.message || err}` });
            setBackupProgress(null);
          }
        };

        const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setRestoreStatus({ type: 'loading', message: 'Reading backup file…' });
          setRestorePreview(null);
          setPendingRestoreData(null);
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result as string);
              if (!parsed._crmBackup) {
                setRestoreStatus({ type: 'error', message: 'This does not appear to be a valid DG-CRM backup file.' });
                return;
              }
              const colNames = Object.keys(parsed.mongodb || {});
              const lsKeys = Object.keys(parsed.localStorage || {});
              setRestorePreview({
                createdAt: parsed.createdAt || 'Unknown',
                createdBy: parsed.createdBy || 'Unknown',
                collections: colNames,
                localKeys: lsKeys,
              });
              setPendingRestoreData(parsed);
              setRestoreStatus({ type: 'idle', message: '' });
            } catch {
              setRestoreStatus({ type: 'error', message: 'Failed to parse backup file. Make sure it is a valid JSON file.' });
            }
          };
          reader.readAsText(file);
          e.target.value = ''; // allow re-selecting same file
        };

        const handleRestore = async () => {
          if (!pendingRestoreData) return;
          const confirmed = await showConfirmDialog(
            'Restore Backup',
            'This will overwrite all current CRM data (clients, users, logs, etc.) with the backup. This cannot be undone.\n\nAre you sure you want to proceed?',
            'warning'
          );
          if (!confirmed) return;

          setRestoreStatus({ type: 'loading', message: 'Restoring localStorage…' });
          setRestoreProgress(0);
          try {
            // 1. Restore localStorage
            const lsData = pendingRestoreData.localStorage || {};
            for (const [key, value] of Object.entries(lsData)) {
              try {
                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
              } catch { /* ignore quota issues for individual keys */ }
            }

            // 2. Restore MongoDB collections IN PARALLEL
            const mongoData = pendingRestoreData.mongodb || {};
            const colEntries = (Object.entries(mongoData) as [string, any[]][]).filter(([, docs]) => Array.isArray(docs) && docs.length > 0);

            setRestoreStatus({ type: 'loading', message: `Restoring ${colEntries.length} MongoDB collections in parallel…` });
            setRestoreProgress(10);

            const BATCH = 50;
            const colResults = await Promise.allSettled(
              colEntries.map(async ([col, docs]) => {
                // Delete existing
                const delRes = await fetch(DB_API, {
                  method: 'POST',
                  headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                  body: JSON.stringify({ collection: col, operation: 'deleteMany', filter: {} }),
                });
                if (!delRes.ok) {
                  const j = await delRes.json().catch(() => ({}));
                  throw new Error(`deleteMany failed for ${col}: ${j.error || delRes.status}`);
                }

                // Re-insert in batches of 50
                for (let j = 0; j < docs.length; j += BATCH) {
                  const batch = docs.slice(j, j + BATCH);
                  const insRes = await fetch(DB_API, {
                    method: 'POST',
                    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                    body: JSON.stringify({ collection: col, operation: 'insertMany', data: batch }),
                  });
                  if (!insRes.ok) {
                    const jb = await insRes.json().catch(() => ({}));
                    throw new Error(`insertMany failed for ${col} batch ${j}: ${jb.error || insRes.status}`);
                  }
                }
                return col;
              })
            );

            const mongoErrors = colResults
              .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
              .map(r => r.reason?.message || String(r.reason));

            setRestoreProgress(100);
            const errNote = mongoErrors.length > 0
              ? ` ⚠️ ${mongoErrors.length} collection error(s): ${mongoErrors.join('; ')}`
              : '';
            setRestoreStatus({ type: mongoErrors.length > 0 ? 'error' : 'success', message: `Restore complete!${errNote} Reload the page to see the restored data.` });
            setRestorePreview(null);
            setPendingRestoreData(null);
            setTimeout(() => setRestoreProgress(null), 2000);
          } catch (err: any) {
            setRestoreStatus({ type: 'error', message: `Restore failed: ${err.message || err}` });
            setRestoreProgress(null);
          }
        };

        const statusBg = (type: string) => ({ idle: '#f8fafc', loading: '#eff6ff', success: '#f0fdf4', error: '#fef2f2' }[type] || '#f8fafc');
        const statusColor = (type: string) => ({ idle: '#64748b', loading: '#1d4ed8', success: '#15803d', error: '#dc2626' }[type] || '#64748b');

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Backup Section */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>📤 Create Backup</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>
                Downloads a full snapshot of all CRM data — clients, users, logs, file metadata, and settings — as a <code>.json</code> file. Store it somewhere safe (Google Drive, email, etc.).
              </p>

              <div style={{ padding: '14px 18px', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#166534', fontWeight: '500' }}>
                  ✅ What is included in the backup:
                </p>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#166534', lineHeight: '1.7' }}>
                  <li>All <strong>client records</strong> (from MongoDB + localStorage cache)</li>
                  <li>All <strong>user accounts</strong></li>
                  <li>Activity logs, log notes, payment data, calendar events, notifications</li>
                  <li>File attachment metadata (R2 paths — not the file binaries)</li>
                  <li>App settings: quota limits, package options, company logo, branding</li>
                </ul>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#4d7c0f' }}>
                  ⚠️ Login tokens are <strong>not</strong> included for security.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleBackup}
                  disabled={backupStatus.type === 'loading'}
                  style={{
                    padding: '12px 28px',
                    background: backupStatus.type === 'loading' ? '#d1fae5' : 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    color: backupStatus.type === 'loading' ? '#065f46' : 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '14px',
                    fontWeight: '700',
                    cursor: backupStatus.type === 'loading' ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 8px rgba(5,150,105,0.3)',
                    transition: 'all 0.2s',
                  }}
                >
                  {backupStatus.type === 'loading' ? '⏳ Creating backup…' : '💾 Save to This Mac'}
                </button>
                <p style={{ margin: 0, fontSize: '12px', color: '#64748b', paddingLeft: '4px' }}>
                  Saves to your <strong>Downloads</strong> folder. You can then move it to Desktop or any folder (512GB storage available).
                </p>
              </div>

              {/* Manual R2 cloud backup trigger */}
              <button
                onClick={async () => {
                  setR2BackupStatus({ type: 'loading', message: 'Starting backup…' });
                  setR2BackupProgress(5);
                  try {
                    // Trigger background function — returns 202 immediately (no timeout)
                    const triggerRes = await fetch('/.netlify/functions/daily-backup-background', {
                      method: 'POST',
                      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });

                    if (!triggerRes.ok && triggerRes.status !== 202) {
                      let errMsg = 'Failed to start backup';
                      try { const j = await triggerRes.json(); errMsg = j.error || errMsg; } catch {}
                      setR2BackupProgress(null);
                      setR2BackupStatus({ type: 'error', message: errMsg });
                      return;
                    }

                    setR2BackupStatus({ type: 'loading', message: 'Connecting to database…' });
                    const todayDate = new Date().toISOString().slice(0, 10);
                    let attempts = 0;
                    const maxAttempts = 30; // 30 × 6s = 3 min

                    const COLLECTION_LABELS: Record<string, string> = {
                      clients:         'Client records',
                      users:           'User accounts',
                      log_notes:       'Log notes',
                      activity_logs:   'Activity logs',
                      file_attachments:'File attachments',
                      calendar_events: 'Calendar events',
                    };

                    const poll = async (): Promise<void> => {
                      attempts++;
                      try {
                        const statusRes = await fetch(`/.netlify/functions/get-backup-status?date=${todayDate}`, { headers: authHeaders() });
                        const statusJson = await statusRes.json();

                        if (statusRes.ok && statusJson.found && statusJson.status) {
                          const s = statusJson.status;

                          if (s.state === 'complete') {
                            setR2BackupProgress(100);
                            setR2BackupStatus({ type: 'success', message: `✅ Backup complete → backups/${todayDate}/  (${s.total ?? 6} collections saved)` });
                            setTimeout(() => setR2BackupProgress(null), 2000);
                            return;
                          }

                          if (s.state === 'error') {
                            setR2BackupProgress(null);
                            setR2BackupStatus({ type: 'error', message: `Backup failed: ${s.error || 'Unknown error'}` });
                            return;
                          }

                          if (s.state === 'running') {
                            const done = s.done ?? 0;
                            const total = s.total ?? 6;
                            const collLabel = COLLECTION_LABELS[s.current] || s.current || 'data';
                            // Real progress: 10% base + up to 85% from collection count
                            const prog = Math.round(10 + (done / total) * 80);
                            setR2BackupProgress(prog);
                            if (s.current === 'connecting') {
                              setR2BackupStatus({ type: 'loading', message: 'Connecting to database…' });
                            } else {
                              setR2BackupStatus({ type: 'loading', message: `Backing up ${collLabel}… (${done + 1} of ${total})` });
                            }
                          }
                        }
                      } catch { /* network blip — keep polling */ }

                      if (attempts >= maxAttempts) {
                        setR2BackupProgress(null);
                        setR2BackupStatus({ type: 'error', message: `Backup is taking longer than expected. Check the R2 Backup Files section below to see if it completed.` });
                        return;
                      }

                      setTimeout(poll, 6000);
                    };

                    setTimeout(poll, 6000);
                  } catch (err: any) {
                    setR2BackupProgress(null);
                    setR2BackupStatus({ type: 'error', message: `Request failed: ${err.message}` });
                  }
                }}
                disabled={r2BackupStatus.type === 'loading'}
                style={{
                  marginLeft: '12px',
                  padding: '12px 28px',
                  background: r2BackupStatus.type === 'loading' ? '#e0f2fe' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: r2BackupStatus.type === 'loading' ? '#0369a1' : 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: r2BackupStatus.type === 'loading' ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {r2BackupStatus.type === 'loading' ? '⏳ Uploading to R2…' : '☁️ Backup to Cloudflare R2'}
              </button>

              {/* Download progress bar */}
              {backupProgress !== null && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '5px', fontWeight: '500' }}>
                    <span>💾 Saving backup to Mac…</span>
                    <span>{backupProgress}%</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${backupProgress}%`, height: '100%', background: backupProgress === 100 ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#059669,#34d399)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )}

              {backupStatus.message && (
                <div style={{ marginTop: '14px', padding: '12px 16px', background: statusBg(backupStatus.type), borderRadius: '8px', fontSize: '13px', color: statusColor(backupStatus.type), border: `1px solid ${backupStatus.type === 'success' ? '#bbf7d0' : backupStatus.type === 'error' ? '#fecaca' : '#bfdbfe'}` }}>
                  {backupStatus.message}
                </div>
              )}

              {/* R2 upload progress bar */}
              {r2BackupProgress !== null && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '5px', fontWeight: '500' }}>
                    <span>☁️ Backup running in background…</span>
                    <span>{r2BackupProgress}%</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${r2BackupProgress}%`, height: '100%', background: r2BackupProgress === 100 ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#0284c7,#38bdf8)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              )}

              {r2BackupStatus.message && (
                <div style={{ marginTop: '10px', padding: '12px 16px', background: statusBg(r2BackupStatus.type), borderRadius: '8px', fontSize: '13px', color: statusColor(r2BackupStatus.type), border: `1px solid ${r2BackupStatus.type === 'success' ? '#bae6fd' : r2BackupStatus.type === 'error' ? '#fecaca' : '#bfdbfe'}` }}>
                  {r2BackupStatus.message}
                </div>
              )}
            </div>

            {/* Restore Section */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>📥 Restore from Backup</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>
                Select a <code>.json</code> backup file created by this system to restore all data. You will see a preview before anything is written.
              </p>

              <div style={{ padding: '14px 18px', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>
                  ⚠️ Warning: Restore will overwrite all existing data
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#991b1b' }}>
                  All current clients, logs, and settings will be replaced by the backup. Create a new backup first if you want to preserve the current state.
                </p>
              </div>

              {/* File picker */}
              <label style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                color: 'white',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '700',
                boxShadow: '0 2px 8px rgba(29,78,216,0.3)',
              }}>
                📂 Select Backup File
                <input type="file" accept=".json,application/json" onChange={handleFileSelect} style={{ display: 'none' }} />
              </label>

              {/* Preview card */}
              {restorePreview && (
                <div style={{ marginTop: '20px', padding: '18px 20px', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: '10px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#92400e' }}>📋 Backup Preview</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', fontSize: '13px', color: '#78350f' }}>
                    <div><strong>Created:</strong> {new Date(restorePreview.createdAt).toLocaleString()}</div>
                    <div><strong>By:</strong> {restorePreview.createdBy}</div>
                    <div><strong>MongoDB collections:</strong> {restorePreview.collections.join(', ')}</div>
                    <div><strong>localStorage keys:</strong> {restorePreview.localKeys.length}</div>
                  </div>
                  <div style={{ marginTop: '14px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleRestore}
                      disabled={restoreStatus.type === 'loading'}
                      style={{
                        padding: '10px 24px',
                        background: restoreStatus.type === 'loading' ? '#fde68a' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                        color: restoreStatus.type === 'loading' ? '#92400e' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '700',
                        cursor: restoreStatus.type === 'loading' ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 6px rgba(220,38,38,0.3)',
                      }}
                    >
                      {restoreStatus.type === 'loading' ? '⏳ Restoring…' : '⚡ Confirm & Restore'}
                    </button>
                    <button
                      onClick={() => { setRestorePreview(null); setPendingRestoreData(null); setRestoreStatus({ type: 'idle', message: '' }); }}
                      style={{ padding: '10px 18px', background: 'white', color: '#64748b', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {restoreStatus.message && (
                <div style={{ marginTop: '14px', padding: '12px 16px', background: statusBg(restoreStatus.type), borderRadius: '8px', fontSize: '13px', color: statusColor(restoreStatus.type), border: `1px solid ${restoreStatus.type === 'success' ? '#bbf7d0' : restoreStatus.type === 'error' ? '#fecaca' : '#bfdbfe'}` }}>
                  {restoreStatus.type === 'loading' && restoreProgress !== null && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '5px', fontWeight: '500' }}>
                        <span>Restoring…</span>
                        <span>{restoreProgress}%</span>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.1)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${restoreProgress}%`, height: '100%', background: restoreProgress === 100 ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#dc2626,#f87171)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )}
                  {restoreStatus.message}
                  {restoreStatus.type === 'success' && (
                    <button
                      onClick={() => window.location.reload()}
                      style={{ marginLeft: '16px', padding: '4px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Reload Page
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Download All R2 Files Section */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>📦 Create ZIP of All R2 Files</h2>
              <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>
                Creates a ZIP archive of all uploaded files (PDFs, images, documents) and saves it to R2. You can then download the ZIP to your Mac from the R2 Backup Files section below.
              </p>

              <div style={{ padding: '14px 18px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', fontWeight: '500' }}>
                  💡 How it works:
                </p>
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#1e40af', lineHeight: '1.7' }}>
                  <li>Creates ZIP with all <strong>uploaded files</strong> (booking confirmations, receipts, documents, images)</li>
                  <li>Files organized with their original folder structure</li>
                  <li>Saves to R2 as "all-files.zip" under today's date</li>
                  <li>Download the ZIP from "R2 Backup Files" section below (look for today's date)</li>
                </ul>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#1e40af' }}>
                  ⚠️ Large file collections may take 1-2 minutes. Refresh the R2 Backup Files list below to see when it's ready.
                </p>
              </div>

              <button
                onClick={async () => {
                  setR2FilesDownloadStatus({ type: 'loading', message: 'Starting ZIP creation…' });
                  try {
                    const response = await fetch('/.netlify/functions/create-r2-files-zip-background', {
                      method: 'POST',
                      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    });

                    if (response.status === 202) {
                      setR2FilesDownloadStatus({ type: 'loading', message: 'Starting ZIP creation…' });
                      setZipProgress(5);
                      
                      const todayDate = new Date().toISOString().slice(0, 10);
                      let attempts = 0;
                      const maxAttempts = 120; // 120 × 5s = 10 min
                      
                      const pollForZip = async (): Promise<void> => {
                        attempts++;
                        
                        try {
                          const statusRes = await fetch(`/.netlify/functions/get-zip-status?date=${todayDate}`, { headers: authHeaders() });
                          const statusData = await statusRes.json();
                          
                          if (statusRes.ok && statusData.found && statusData.status) {
                            const s = statusData.status;
                            
                            if (s.state === 'complete') {
                              setZipProgress(100);
                              const sizeMB = s.sizeBytes ? ` (${(s.sizeBytes / 1024 / 1024).toFixed(1)} MB)` : '';
                              setR2FilesDownloadStatus({ 
                                type: 'success', 
                                message: `✅ ZIP created! ${s.total} files archived${sizeMB}. Scroll down to "R2 Backup Files" to download it.` 
                              });
                              setTimeout(() => {
                                const btn = document.querySelector('[aria-label="Refresh R2 backups"]') as HTMLButtonElement;
                                btn?.click();
                              }, 500);
                              setTimeout(() => { setR2FilesDownloadStatus({ type: 'idle', message: '' }); setZipProgress(null); }, 10000);
                              return;
                            }
                            
                            if (s.state === 'error') {
                              setZipProgress(null);
                              setR2FilesDownloadStatus({ type: 'error', message: `ZIP failed: ${s.error || 'Unknown error'}` });
                              return;
                            }
                            
                            if (s.state === 'running') {
                              const done = s.done ?? 0;
                              const total = s.total ?? 1;
                              const phase = s.phase || 'zipping';
                              
                              if (phase === 'listing') {
                                setZipProgress(8);
                                setR2FilesDownloadStatus({ type: 'loading', message: 'Listing files in R2…' });
                              } else if (phase === 'uploading') {
                                setZipProgress(95);
                                setR2FilesDownloadStatus({ type: 'loading', message: 'Uploading ZIP to R2…' });
                              } else {
                                // zipping phase — real progress
                                const prog = total > 0 ? Math.round(10 + (done / total) * 80) : 10;
                                setZipProgress(prog);
                                setR2FilesDownloadStatus({ type: 'loading', message: `Zipping files… ${done} of ${total}` });
                              }
                            }
                          }
                        } catch (err) {
                          console.error('Polling error:', err);
                          // Continue polling despite network blip
                        }
                        
                        if (attempts >= maxAttempts) {
                          setZipProgress(null);
                          setR2FilesDownloadStatus({ 
                            type: 'error', 
                            message: 'ZIP creation timed out after 10 minutes. Refresh the R2 Backup Files list to check if it completed.' 
                          });
                          return;
                        }
                        
                        setTimeout(() => pollForZip(), 5000);
                      };
                      
                      pollForZip();
                      return;
                    }

                    if (!response.ok) {
                      let errorMsg = 'Failed to start ZIP creation';
                      try {
                        const errorData = await response.json();
                        errorMsg = errorData.error || errorMsg;
                      } catch {}
                      setR2FilesDownloadStatus({ type: 'error', message: errorMsg });
                      return;
                    }

                  } catch (error) {
                    console.error('Start ZIP creation error:', error);
                    setZipProgress(null);
                    setR2FilesDownloadStatus({ 
                      type: 'error', 
                      message: error instanceof Error ? error.message : 'Failed to start ZIP creation' 
                    });
                  }
                }}
                disabled={r2FilesDownloadStatus.type === 'loading'}
                style={{
                  padding: '12px 28px',
                  background: r2FilesDownloadStatus.type === 'loading' ? '#dbeafe' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: r2FilesDownloadStatus.type === 'loading' ? '#075985' : 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: r2FilesDownloadStatus.type === 'loading' ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px rgba(2,132,199,0.3)',
                  transition: 'all 0.2s',
                }}
              >
                {r2FilesDownloadStatus.type === 'loading' ? '⏳ Creating ZIP…' : '📦 Create ZIP of All Files'}
              </button>

              {/* ZIP progress bar */}
              {zipProgress !== null && (
                <div style={{ marginTop: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '5px', fontWeight: '500' }}>
                    <span>{zipProgress === 100 ? '✅ ZIP ready!' : '📦 Creating ZIP archive…'}</span>
                    <span>{zipProgress}%</span>
                  </div>
                  <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${zipProgress}%`, height: '100%', background: zipProgress === 100 ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#0284c7,#38bdf8)', borderRadius: '99px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}

              {r2FilesDownloadStatus.message && r2FilesDownloadStatus.type !== 'loading' && (
                <div style={{
                  marginTop: '12px',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  background: r2FilesDownloadStatus.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${r2FilesDownloadStatus.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                  color: r2FilesDownloadStatus.type === 'success' ? '#166534' : '#991b1b',
                  fontSize: '13px',
                  fontWeight: '500',
                }}>
                  {r2FilesDownloadStatus.message}
                </div>
              )}
            </div>

            {/* R2 Backup Files Browser */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
              {/* Header row: title + date filter + refresh */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>🗂️ R2 Backup Files</h2>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>All backups stored in Cloudflare R2 — grouped by date.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Date filter dropdown — only shown once data is loaded */}
                  {r2BackupList !== null && r2BackupList.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <label style={{ fontSize: '13px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>📅 Date:</label>
                      <select
                        value={r2SelectedDate}
                        onChange={e => setR2SelectedDate(e.target.value)}
                        style={{
                          padding: '7px 32px 7px 10px',
                          border: '1.5px solid #e2e8f0',
                          borderRadius: '8px',
                          fontSize: '13px',
                          color: '#1e293b',
                          background: 'white',
                          fontWeight: '600',
                          cursor: 'pointer',
                          appearance: 'none',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 10px center',
                          minWidth: '140px',
                        }}
                      >
                        <option value="">All dates ({r2BackupList.length})</option>
                        {r2BackupList.map(g => (
                          <option key={g.date} value={g.date}>
                            {g.date} ({g.files.length} file{g.files.length !== 1 ? 's' : ''})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    aria-label="Refresh R2 backups"
                    onClick={async () => {
                      setR2BackupListLoading(true);
                      setR2BackupListError('');
                      try {
                        const res = await fetch('/.netlify/functions/list-backups', {
                          headers: authHeaders(),
                        });
                        const json = await res.json();
                        if (res.ok && json.success) {
                          setR2BackupList(json.backups);
                          // Auto-select the most recent date if nothing selected
                          if (!r2SelectedDate && json.backups.length > 0) {
                            setR2SelectedDate(json.backups[0].date);
                          }
                        } else {
                          setR2BackupListError(json.error || 'Failed to load backup list');
                        }
                      } catch (err: any) {
                        setR2BackupListError(`Request failed: ${err.message}`);
                      } finally {
                        setR2BackupListLoading(false);
                      }
                    }}
                    disabled={r2BackupListLoading}
                    style={{
                      padding: '9px 20px',
                      background: r2BackupListLoading ? '#e0f2fe' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: r2BackupListLoading ? '#0369a1' : 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: r2BackupListLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r2BackupListLoading ? '⏳ Loading…' : '🔄 Refresh'}
                  </button>
                </div>
              </div>

              {r2BackupListError && (
                <div style={{ padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', border: '1px solid #fecaca', marginBottom: '12px' }}>
                  {r2BackupListError}
                </div>
              )}

              {r2BackupList === null && !r2BackupListLoading && !r2BackupListError && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  Click <strong>Refresh</strong> to load backup files from Cloudflare R2.
                </div>
              )}

              {r2BackupList !== null && r2BackupList.length === 0 && (
                <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  No backups found. Create your first backup using the button above.
                </div>
              )}

              {r2BackupList !== null && r2BackupList.length > 0 && (() => {
                const filtered = r2SelectedDate
                  ? r2BackupList.filter(g => g.date === r2SelectedDate)
                  : r2BackupList;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filtered.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        No backups for {r2SelectedDate}.
                      </div>
                    )}
                    {filtered.map(group => (
                      <div key={group.date} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                        {/* Date header */}
                        <div style={{ padding: '10px 16px', background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>📅 {group.date}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>
                              {group.files.length} file{group.files.length !== 1 ? 's' : ''} · {(group.totalSize / 1024).toFixed(1)} KB total
                            </span>
                            <button
                              onClick={async () => {
                                const ok = await showConfirmDialog(
                                  'Delete Entire Backup',
                                  `Delete ALL ${group.files.length} file(s) for ${group.date}? This cannot be undone.`,
                                  'warning'
                                );
                                if (!ok) return;
                                try {
                                  const res = await fetch(
                                    `/.netlify/functions/delete-backup-file?key=${encodeURIComponent(`backups/${group.date}/`)}`,
                                    { method: 'DELETE', headers: authHeaders() }
                                  );
                                  const j = await res.json();
                                  if (res.ok && j.success) {
                                    setR2BackupList(prev => prev ? prev.filter(g => g.date !== group.date) : prev);
                                    if (r2SelectedDate === group.date) setR2SelectedDate('');
                                  } else {
                                    alert(`Delete failed: ${j.error || res.status}`);
                                  }
                                } catch (err: any) {
                                  alert(`Delete failed: ${err.message}`);
                                }
                              }}
                              style={{ padding: '3px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                              🗑️ Delete all
                            </button>
                          </div>
                        </div>
                        {/* Files list */}
                        <div>
                          {group.files.map((file, idx) => (
                            <div
                              key={file.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 16px',
                                borderTop: idx === 0 ? 'none' : '1px solid #f1f5f9',
                                background: 'white',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <span style={{ fontSize: '16px' }}>{file.name === 'manifest.json' ? '📋' : file.name === 'status.json' ? '📊' : '📄'}</span>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                    {(file.size / 1024).toFixed(1)} KB
                                    {file.lastModified ? ` · ${new Date(file.lastModified).toLocaleString()}` : ''}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch(
                                        `/.netlify/functions/download-backup-file?key=${encodeURIComponent(file.key)}`,
                                        { headers: authHeaders() }
                                      );
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}));
                                        alert(`Download failed: ${j.error || res.status}`);
                                        return;
                                      }
                                      const blob = await res.blob();
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = file.name;
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    } catch (err: any) {
                                      alert(`Download failed: ${err.message}`);
                                    }
                                  }}
                                  style={{ padding: '5px 14px', background: '#f1f5f9', color: '#0369a1', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  ⬇️ Download
                                </button>
                                <button
                                  onClick={async () => {
                                    const ok = await showConfirmDialog(
                                      'Delete Backup File',
                                      `Delete ${file.name} from ${group.date}? This cannot be undone.`,
                                      'warning'
                                    );
                                    if (!ok) return;
                                    try {
                                      const res = await fetch(
                                        `/.netlify/functions/delete-backup-file?key=${encodeURIComponent(file.key)}`,
                                        { method: 'DELETE', headers: authHeaders() }
                                      );
                                      const j = await res.json();
                                      if (res.ok && j.success) {
                                        setR2BackupList(prev => prev ? prev.map(g =>
                                          g.date !== group.date ? g : {
                                            ...g,
                                            files: g.files.filter(f => f.key !== file.key),
                                            totalSize: g.totalSize - file.size,
                                          }
                                        ).filter(g => g.files.length > 0) : prev);
                                      } else {
                                        alert(`Delete failed: ${j.error || res.status}`);
                                      }
                                    } catch (err: any) {
                                      alert(`Delete failed: ${err.message}`);
                                    }
                                  }}
                                  style={{ padding: '5px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Backup Schedule Info */}
            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '20px 24px', border: '1px solid #e2e8f0' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>💡 Best Practices</p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#64748b', lineHeight: '1.8' }}>
                <li>Create a backup <strong>before major changes</strong> (adding many clients, role changes, etc.)</li>
                <li>Store backups in a <strong>secure location</strong> (Google Drive, company email, encrypted storage)</li>
                <li>Label backup files with the date — the filename already includes it</li>
                <li>Backups do <strong>not</strong> include file binaries (PDFs, images) — those are safe in Cloudflare R2</li>
              </ul>
            </div>
          </div>
        );
      })()}

      {/* Packages Tab */}
      {activeTab === 'packages' && (() => {
        const persistOptions = (opts: string[]) => {
          setPackageOptions(opts);
          savePackageOptions(opts);
        };

        const addPackage = () => {
          const trimmed = newPackageInput.trim();
          if (!trimmed) return;
          if (packageOptions.some(o => o.toLowerCase() === trimmed.toLowerCase())) {
            showErrorToast('A package with that name already exists.');
            return;
          }
          persistOptions([...packageOptions, trimmed]);
          setNewPackageInput('');
          showSuccessToast(`Package "${trimmed}" added.`);
        };

        const deletePackage = async (idx: number) => {
          const name = packageOptions[idx];
          const ok = await showConfirmDialog('Remove Package', `Remove "${name}" from the dropdown list? Existing clients that already have this package name are not affected.`, 'warning');
          if (!ok) return;
          persistOptions(packageOptions.filter((_, i) => i !== idx));
          showSuccessToast(`"${name}" removed.`);
        };

        const saveEdit = (idx: number) => {
          const trimmed = packageEditValue.trim();
          if (!trimmed) return;
          if (packageOptions.some((o, i) => i !== idx && o.toLowerCase() === trimmed.toLowerCase())) {
            showErrorToast('A package with that name already exists.');
            return;
          }
          const updated = [...packageOptions];
          updated[idx] = trimmed;
          persistOptions(updated);
          setPackageEditIdx(null);
          setPackageEditValue('');
          showSuccessToast('Package updated.');
        };

        const moveUp = (idx: number) => {
          if (idx === 0) return;
          const arr = [...packageOptions];
          [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
          persistOptions(arr);
        };

        const moveDown = (idx: number) => {
          if (idx === packageOptions.length - 1) return;
          const arr = [...packageOptions];
          [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
          persistOptions(arr);
        };

        return (
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', boxShadow: '0 2px 12px rgba(10,45,116,0.08)', border: '1px solid rgba(10,45,116,0.08)' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>📦 Package Options</h2>
            <p style={{ margin: '0 0 20px 0', color: '#64748b', fontSize: '13px' }}>
              Manage the list of tour/package names available in the Package dropdown on client forms. Existing client records are never changed — their package name is preserved as-is.
            </p>

            {/* Add new */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <input
                value={newPackageInput}
                onChange={e => setNewPackageInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPackage()}
                placeholder="e.g. ROUTE N ADVANCE"
                maxLength={150}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  border: '1.5px solid #d1dbe8',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  fontFamily: "'Poppins', sans-serif",
                }}
              />
              <button
                onClick={addPackage}
                style={{ padding: '10px 22px', background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                + Add Package
              </button>
            </div>

            {/* List */}
            {packageOptions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                No packages added yet. Type a name above and click "+ Add Package".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {packageOptions.map((opt, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '10px 14px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    {/* Reorder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ padding: '1px 5px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#cbd5e1' : '#64748b', fontSize: 10, lineHeight: 1 }}>▲</button>
                      <button onClick={() => moveDown(idx)} disabled={idx === packageOptions.length - 1} style={{ padding: '1px 5px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '4px', cursor: idx === packageOptions.length - 1 ? 'default' : 'pointer', color: idx === packageOptions.length - 1 ? '#cbd5e1' : '#64748b', fontSize: 10, lineHeight: 1 }}>▼</button>
                    </div>

                    {/* Name or edit input */}
                    {packageEditIdx === idx ? (
                      <input
                        autoFocus
                        value={packageEditValue}
                        onChange={e => setPackageEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(idx); if (e.key === 'Escape') { setPackageEditIdx(null); setPackageEditValue(''); } }}
                        maxLength={150}
                        style={{ padding: '6px 10px', border: '1.5px solid #0891b2', borderRadius: '6px', fontSize: '14px', outline: 'none', fontFamily: "'Poppins', sans-serif" }}
                      />
                    ) : (
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{opt}</span>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {packageEditIdx === idx ? (
                        <>
                          <button onClick={() => saveEdit(idx)} style={{ padding: '5px 12px', background: '#0891b2', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => { setPackageEditIdx(null); setPackageEditValue(''); }} style={{ padding: '5px 10px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setPackageEditIdx(idx); setPackageEditValue(opt); }} style={{ padding: '5px 10px', background: 'white', color: '#0891b2', border: '1px solid #0891b2', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                          <button onClick={() => deletePackage(idx)} style={{ padding: '5px 10px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Remove</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
              {packageOptions.length} package{packageOptions.length !== 1 ? 's' : ''} configured. Changes apply immediately to the dropdown on all client forms.
            </p>

            {/* Packages found in existing client records */}
            {(() => {
              const adminLower = new Set(packageOptions.map((o: string) => o.toLowerCase()));
              const clientPkgs = getClientPackages().filter((p: string) => !adminLower.has(p.toLowerCase()));
              if (clientPkgs.length === 0) return null;
              return (
                <div style={{ marginTop: 28 }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '700', color: '#475569' }}>📋 Found in Existing Clients</h3>
                  <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#94a3b8' }}>
                    These package names are already used by clients but are not yet in your configured list. Click <strong>+ Add</strong> to promote them.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {clientPkgs.map((pkg: string) => (
                      <div key={pkg} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', background: '#f0f9ff', borderRadius: '8px', border: '1px dashed #bae6fd' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#0c4a6e' }}>{pkg}</span>
                        <button
                          onClick={() => {
                            if (packageOptions.some((o: string) => o.toLowerCase() === pkg.toLowerCase())) return;
                            persistOptions([...packageOptions, pkg]);
                            showSuccessToast(`"${pkg}" added to configured packages.`);
                          }}
                          style={{ padding: '5px 14px', background: '#0891b2', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })()}

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
