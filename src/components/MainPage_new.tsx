import React, { useState, useEffect, useCallback } from 'react';
import { ClientService, type ClientData } from '../services/clientService';
import Sidebar from "./Sidebar";

// Inline fallback ClientRecords component to avoid missing module error.
// This simple component matches the props used in this file and can be
// replaced by a full-featured ./ClientRecords component later.
const ClientRecords: React.FC<{
  onClientSelect?: (id?: string) => void;
  onNavigateBack?: () => void;
}> = ({ onClientSelect, onNavigateBack }) => {
  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <button
          onClick={onNavigateBack}
          style={{
            padding: '8px 12px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, color: '#2c3e50' }}>Client Records</h2>
      </div>
      <p style={{ color: '#6c757d' }}>Placeholder client records view — replace with real implementation when available.</p>
      <div style={{ marginTop: '12px' }}>
        <button
          onClick={() => onClientSelect && onClientSelect()}
          style={{
            padding: '8px 12px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          Select Client (placeholder)
        </button>
      </div>
    </div>
  );
};

const MainPage: React.FC = () => {
  const [clients, setClients] = useState<ClientData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, float: 0, refund: 0, travelFunds: 0, cancelled: 0 });
  
  // Navigation state for form view
  const [viewingForm, setViewingForm] = useState<{clientId?: string, clientName?: string} | null>(null);

  const loadClients = useCallback(async () => {
    setLoading(true);
    try {
      const allClients = await ClientService.searchClients({
        searchTerm: searchQuery,
        status: statusFilter || undefined
      });
      setClients(allClients);
      
      const clientStats = await ClientService.getClientStats();
      // Map the stats to the expected format
      setStats({
        total: clientStats.total,
        active: clientStats.statusCounts['Active'] || 0,
        float: clientStats.statusCounts['Float'] || 0,
        refund: clientStats.statusCounts['Refund'] || 0,
        travelFunds: clientStats.statusCounts['Travel Funds'] || 0,
        cancelled: clientStats.statusCounts['Cancelled'] || 0
      });
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
  };

  const handleClientEdit = (client: ClientData) => {
    setViewingForm({clientId: client.id, clientName: client.contactName});
  };

  const handleAddNewClient = () => {
    setViewingForm({});
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return '#4CAF50';
      case 'lead': return '#2196F3';
      case 'referral': return '#FF9800';
      case 'transferred': return '#9C27B0';
      case 'cancelled': return '#F44336';
      default: return '#757575';
    }
  };

  const handleNavigateToClientRecords = () => {
    // This function is no longer needed since we're on the records page by default
  };

  return (
    <>
      {viewingForm ? (
        <ClientRecords
          onClientSelect={() => {}}
          onNavigateBack={() => setViewingForm(null)}
        />
      ) : (
        <div style={{ display: 'flex' }}>
          <Sidebar
            onNavigateToClientRecords={handleNavigateToClientRecords}
            onNavigateToProfile={() => {}}
            onNavigateToDeleted={() => {}}
            onNavigateToActivityLog={() => {}}
          />
          <div style={{
            marginLeft: '300px',
            padding: '20px',
            maxWidth: '1200px',
            margin: '0 auto 0 300px',
            backgroundColor: '#f5f5f5'
          }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '30px',
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div>
            <h1 style={{ 
              margin: '0 0 10px 0',
              color: '#2c3e50',
              fontSize: '28px'
            }}>
              Client Records
            </h1>
            <p style={{ 
              margin: 0,
              color: '#7f8c8d',
              fontSize: '14px'
            }}>
              Manage and search through all client documents
            </p>
          </div>
          <button
            onClick={handleAddNewClient}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              transition: 'background-color 0.3s ease'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
          >
            + Add New Client
          </button>
        </div>

        {/* Search and Filter Section */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '20px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '20px',
            alignItems: 'end'
          }}>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Search Clients
              </label>
              <input
                type="text"
                placeholder="Search by name, email, client number, or phone..."
                value={searchQuery}
                onChange={handleSearchChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  transition: 'border-color 0.3s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3498db'}
                onBlur={(e) => e.target.style.borderColor = '#e9ecef'}
              />
            </div>
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#2c3e50'
              }}>
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={handleStatusFilterChange}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Float">Float</option>
                <option value="Refund">Refund</option>
                <option value="Travel Funds">Travel Funds</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #3498db'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#3498db' }}>
              {stats.total}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Total Clients
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #27ae60'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#27ae60' }}>
              {stats.active}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Active
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #f39c12'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#f39c12' }}>
              {stats.float}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Float
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #e74c3c'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#e74c3c' }}>
              {stats.refund}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Refund
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #9b59b6'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9b59b6' }}>
              {stats.travelFunds}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Travel Funds
            </div>
          </div>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            textAlign: 'center',
            border: '3px solid #95a5a6'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#95a5a6' }}>
              {stats.cancelled}
            </div>
            <div style={{ color: '#7f8c8d', fontSize: '14px', marginTop: '4px' }}>
              Cancelled
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '16px' }}>⏳</div>
            <p>Loading clients...</p>
          </div>
        ) : clients.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
              👥
            </div>
            <h3 style={{ color: '#6c757d', margin: '0 0 8px 0' }}>
              {searchQuery || statusFilter ? 'No Clients Found' : 'No Clients Yet'}
            </h3>
            <p style={{ color: '#adb5bd', margin: 0 }}>
              {searchQuery || statusFilter 
                ? 'Try adjusting your search criteria or filters.'
                : 'Start by adding your first client to the system.'
              }
            </p>
            {!searchQuery && !statusFilter && (
              <button
                onClick={handleAddNewClient}
                style={{
                  marginTop: '16px',
                  padding: '12px 24px',
                  backgroundColor: '#3498db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Add First Client
              </button>
            )}
          </div>
        ) : (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #e9ecef',
              backgroundColor: '#f8f9fa'
            }}>
              <h3 style={{ margin: 0, color: '#2c3e50' }}>
                Client List ({clients.length} {clients.length === 1 ? 'client' : 'clients'})
              </h3>
            </div>
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {clients.map((client, index) => (
                <div
                  key={client.id}
                  style={{
                    padding: '20px',
                    borderBottom: index < clients.length - 1 ? '1px solid #e9ecef' : 'none',
                    transition: 'background-color 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                  onClick={() => handleClientEdit(client)}
                >
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto auto',
                    gap: '20px',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <h4 style={{
                          margin: 0,
                          color: '#2c3e50',
                          fontSize: '16px'
                        }}>
                          {client.contactName}
                        </h4>
                        <span style={{
                          padding: '2px 8px',
                          backgroundColor: getStatusColor(client.status || 'unknown'),
                          color: 'white',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500'
                        }}>
                          {client.status}
                        </span>
                      </div>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '8px',
                        fontSize: '13px',
                        color: '#6c757d'
                      }}>
                        <div>📧 {client.email || 'No email'}</div>
                        <div>📞 {client.contactNo || 'No phone'}</div>
                        <div>🆔 {client.clientNo || 'No client number'}</div>
                        <div>👤 Agent: {client.agent || 'Unassigned'}</div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClientEdit(client);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
                    >
                      ✏️ Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
        </div>
      )}
    </>
  );
};

export default MainPage;