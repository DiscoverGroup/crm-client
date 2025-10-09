import React from 'react';

interface ClientRecordsProps {
  onClientSelect?: () => void;
  onNavigateBack?: () => void;
}

const ClientRecords: React.FC<ClientRecordsProps> = ({ onNavigateBack }) => {
  return (
    <div style={{
      padding: '20px',
      maxWidth: '1200px',
      margin: '0 auto',
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
            Client Form
          </h1>
          <p style={{ 
            margin: 0,
            color: '#7f8c8d',
            fontSize: '16px'
          }}>
            Add new client or edit existing client information
          </p>
        </div>
        <button
          onClick={onNavigateBack}
          style={{
            padding: '12px 24px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.3s ease'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Form placeholder */}
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>
          📝
        </div>
        <h3 style={{ color: '#6c757d', margin: '0 0 8px 0' }}>
          Client Form Coming Soon
        </h3>
        <p style={{ color: '#adb5bd', margin: 0 }}>
          The client form will be moved here from the main page. This will contain all the client details, payment information, and file attachments.
        </p>
      </div>
    </div>
  );
};

export default ClientRecords;