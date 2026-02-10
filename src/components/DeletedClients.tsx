import React, { useState, useEffect } from 'react';
import { ClientService, type ClientData } from '../services/clientService';
import { ActivityLogService } from '../services/activityLogService';
import { FileService, type FileAttachment } from '../services/fileService';
import { FileRecoveryService } from '../services/fileRecoveryService';
import { ClientRecoveryService } from '../services/clientRecoveryService';

interface DeletedClientsProps {
  currentUser: string;
  onBack: () => void;
}

const DeletedClients: React.FC<DeletedClientsProps> = ({ currentUser, onBack }) => {
  const [deletedClients, setDeletedClients] = useState<ClientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [clientFiles, setClientFiles] = useState<FileAttachment[]>([]);
  const [showFilesModal, setShowFilesModal] = useState(false);

  // Get current user's profile image R2 path
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
    loadDeletedClients();
  }, []);

  const loadDeletedClients = () => {
    setLoading(true);
    const clients = ClientService.getDeletedClients();
    setDeletedClients(clients);
    setLoading(false);
  };

  const handleRecover = async (client: ClientData) => {
    if (window.confirm(`Request recovery for client "${client.contactName}"?`)) {
      const request = ClientRecoveryService.createRecoveryRequest(
        client.id,
        client.contactName || 'Unknown',
        client.clientNo,
        currentUser,
        'Client recovery requested from deleted clients'
      );

      if (request) {
        alert(`Recovery request submitted for "${client.contactName}". An admin will review your request.`);
      } else {
        alert('Failed to create recovery request.');
      }
    }
  };

  const handlePermanentDelete = async (client: ClientData) => {
    if (window.confirm(`PERMANENTLY delete "${client.contactName}"? This action CANNOT be undone!`)) {
      if (window.confirm('Are you absolutely sure? This will delete all data permanently.')) {
        const success = await ClientService.permanentlyDeleteClient(client.id);
        if (success) {
          ActivityLogService.addLog({
            clientId: client.id,
            clientName: client.contactName || 'Unknown',
            action: 'permanently_deleted',
            performedBy: currentUser,
            performedByUser: currentUser,
            profileImageR2Path: getCurrentUserProfileImagePath(),
            details: 'Client permanently deleted from system'
          });
          alert('Client permanently deleted.');
          loadDeletedClients();
        } else {
          alert('Failed to delete client.');
        }
      }
    }
  };

  const handleViewFiles = (client: ClientData) => {
    setSelectedClient(client);
    const files = FileService.getFilesByClient(client.id);
    setClientFiles(files);
    setShowFilesModal(true);
  };

  const handleRequestFileRecovery = (file: FileAttachment) => {
    if (!selectedClient) return;
    
    if (window.confirm(`Request recovery for file "${file.file.name}"?`)) {
      const request = FileRecoveryService.createRecoveryRequest(
        file.file.id,
        file.file.name,
        file.category,
        selectedClient.id,
        selectedClient.contactName || 'Unknown',
        currentUser,
        'File recovery requested from deleted client'
      );

      if (request) {
        alert(`Recovery request submitted for "${file.file.name}". An admin will review your request.`);
      } else {
        alert('Failed to create recovery request.');
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      padding: '20px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
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
            <h1 style={{ margin: '0 0 5px 0', color: '#dc3545', fontSize: '28px' }}>
              🗑️ Deleted Clients
            </h1>
            <p style={{ margin: 0, color: '#6c757d', fontSize: '14px' }}>
              Recover or permanently delete client records
            </p>
          </div>
        </div>
        <div style={{
          padding: '10px 20px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '8px',
          color: '#856404',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {deletedClients.length} deleted {deletedClients.length === 1 ? 'client' : 'clients'}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
          <p>Loading deleted clients...</p>
        </div>
      ) : deletedClients.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px', opacity: 0.3 }}>🗑️</div>
          <h3 style={{ color: '#6c757d', margin: '0 0 10px 0' }}>
            Trash is Empty
          </h3>
          <p style={{ color: '#adb5bd', margin: 0 }}>
            No deleted clients to display
          </p>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead style={{
              backgroundColor: '#f8f9fa',
              borderBottom: '2px solid #dee2e6'
            }}>
              <tr>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Client Name
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Email
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Client No.
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Deleted By
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'left',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Deleted At
                </th>
                <th style={{
                  padding: '16px 20px',
                  textAlign: 'center',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#6c757d',
                  whiteSpace: 'nowrap'
                }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {deletedClients.map((client, index) => (
                <tr
                  key={client.id}
                  style={{
                    borderBottom: index < deletedClients.length - 1 ? '1px solid #e9ecef' : 'none',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                >
                  <td style={{
                    padding: '16px 20px',
                    color: '#2c3e50',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}>
                    {client.contactName || 'N/A'}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    color: '#6c757d',
                    fontSize: '13px'
                  }}>
                    {client.email || 'No email'}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    color: '#6c757d',
                    fontSize: '13px'
                  }}>
                    {client.clientNo || 'N/A'}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    color: '#6c757d',
                    fontSize: '13px'
                  }}>
                    {client.deletedBy || 'Unknown'}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    color: '#6c757d',
                    fontSize: '13px'
                  }}>
                    {formatDate(client.deletedAt)}
                  </td>
                  <td style={{
                    padding: '16px 20px',
                    textAlign: 'center'
                  }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => handleViewFiles(client)}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#138496'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#17a2b8'}
                      >
                        📁 View Files
                      </button>
                      <button
                        onClick={() => handleRecover(client)}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                      >
                        📤 Request Recovery
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(client)}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          fontWeight: '500'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                      >
                        ⚠️ Delete Forever
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Files Modal */}
      {showFilesModal && selectedClient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '80vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e9ecef',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#2c3e50' }}>
                  📁 Files for {selectedClient.contactName}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#6c757d' }}>
                  Request file recovery from deleted client
                </p>
              </div>
              <button
                onClick={() => setShowFilesModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px'
            }}>
              {clientFiles.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#6c757d'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📂</div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: '500' }}>
                    No files found for this client
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {clientFiles.map((fileAttachment) => (
                    <div
                      key={fileAttachment.file.id}
                      style={{
                        border: '1px solid #e9ecef',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: '#f8f9fa',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          marginBottom: '8px'
                        }}>
                          <span style={{ fontSize: '24px' }}>📄</span>
                          <div>
                            <div style={{
                              fontWeight: '500',
                              color: '#2c3e50',
                              fontSize: '14px',
                              marginBottom: '4px'
                            }}>
                              {fileAttachment.file.name}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              color: '#6c757d'
                            }}>
                              <span style={{
                                backgroundColor: '#e9ecef',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                marginRight: '8px'
                              }}>
                                {fileAttachment.category}
                              </span>
                              {(fileAttachment.file.size / 1024).toFixed(2)} KB • 
                              {' '}Uploaded: {new Date(fileAttachment.file.uploadDate).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestFileRecovery(fileAttachment)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
                        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#007bff'}
                      >
                        🔄 Request Recovery
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e9ecef',
              backgroundColor: '#f8f9fa',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowFilesModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeletedClients;
