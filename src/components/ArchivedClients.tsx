import React, { useState, useEffect } from 'react';
import { ClientService, type ClientData } from '../services/clientService';
import { ActivityLogService } from '../services/activityLogService';
import { showSuccessToast, showErrorToast, showConfirmDialog } from '../utils/toast';

interface ArchivedClientsProps {
  currentUser: string;
  onBack: () => void;
}

const ArchivedClients: React.FC<ArchivedClientsProps> = ({ currentUser, onBack }) => {
  const [archivedClients, setArchivedClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);

  const getCurrentUserProfileImagePath = (): string | undefined => {
    const users = localStorage.getItem('crm_users');
    if (users) {
      const userList = JSON.parse(users);
      const user = userList.find((u: any) => u.fullName === currentUser);
      return user?.profileImageR2Path;
    }
    return undefined;
  };

  useEffect(() => {
    loadArchivedClients();
  }, []);

  const loadArchivedClients = () => {
    setLoading(true);
    const clients = ClientService.getArchivedClients();
    setArchivedClients(clients);
    setLoading(false);
  };

  const handleUnarchive = async (client: ClientData) => {
    const confirmed = await showConfirmDialog(
      'Unarchive Client',
      `Restore "${client.contactName}" to the active client list?`,
      'info'
    );
    if (confirmed) {
      const success = await ClientService.unarchiveClient(client.id);
      if (success) {
        ActivityLogService.addLog({
          clientId: client.id,
          clientName: client.contactName || 'Unknown',
          action: 'edited',
          performedBy: currentUser,
          performedByUser: currentUser,
          profileImageR2Path: getCurrentUserProfileImagePath(),
          details: 'Client restored from archive'
        });
        showSuccessToast(`"${client.contactName}" restored from archive.`);
        loadArchivedClients();
      } else {
        showErrorToast('Failed to unarchive client.');
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '30px',
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button
            onClick={onBack}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: '0 0 5px 0', color: '#d97706', fontSize: '28px' }}>
              🗃️ Archived Clients
            </h1>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
              View and restore archived client records
            </p>
          </div>
        </div>
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          color: '#92400e',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {archivedClients.length} archived {archivedClients.length === 1 ? 'client' : 'clients'}
        </div>
      </div>

      {/* Client List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b', fontSize: '15px' }}>
          Loading archived clients...
        </div>
      ) : archivedClients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.4 }}>🗃️</div>
          <h3 style={{ color: '#0A2D74', margin: '0 0 8px 0' }}>No Archived Clients</h3>
          <p style={{ color: '#94a3b8', margin: 0 }}>Archived clients will appear here.</p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(135deg, #92400e 0%, #b45309 100%)' }}>
                {['Client Name', 'Status', 'Client No.', 'Sales Agent', 'Archived At', 'Archived By', 'Actions'].map(h => (
                  <th key={h} style={{
                    padding: '13px 16px',
                    textAlign: h === 'Actions' ? 'center' : 'left',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: 'rgba(255,255,255,0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    whiteSpace: 'nowrap'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {archivedClients.map((client, index) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    background: index % 2 === 0 ? '#ffffff' : '#fffbeb'
                  }}
                >
                  <td style={{ padding: '14px 16px', color: '#0A2D74', fontSize: '14px', fontWeight: '600' }}>
                    {client.contactName}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '3px 10px',
                      backgroundColor: '#f59e0b',
                      color: 'white',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {client.status || 'N/A'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px', fontFamily: 'monospace' }}>
                    {client.clientNo || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                    {client.agent || <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>Unassigned</span>}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                    {formatDate(client.archivedAt)}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '13px' }}>
                    {client.archivedBy || '—'}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => handleUnarchive(client)}
                      style={{
                        padding: '6px 16px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 6px rgba(245,158,11,0.3)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 10px rgba(245,158,11,0.45)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(245,158,11,0.3)';
                      }}
                    >
                      ↩️ Unarchive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ArchivedClients;
