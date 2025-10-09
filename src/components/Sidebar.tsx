import React from 'react';

interface SidebarProps {
  onNavigateToClientRecords: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigateToClientRecords }) => {
  return (
    <div style={{
      width: '300px',
      background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
      color: 'white',
      padding: '20px',
      height: '100vh',
      boxShadow: '2px 0 10px rgba(0,0,0,0.1)',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 1000
    }}>
      {/* Header */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          margin: '0 0 10px 0',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          CRM Dashboard
        </h2>
        <p style={{ 
          margin: 0,
          opacity: 0.8,
          fontSize: '14px'
        }}>
          Client Management System
        </p>
      </div>

      {/* Navigation Menu */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{
          margin: '0 0 15px 0',
          fontSize: '16px',
          fontWeight: '500',
          opacity: 0.9
        }}>
          Navigation
        </h3>

        {/* Client Records Button */}
        <button
          onClick={onNavigateToClientRecords}
          style={{
            width: '100%',
            padding: '15px',
            backgroundColor: '#3498db',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '10px',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#2980b9';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = '#3498db';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span style={{ fontSize: '18px' }}>📋</span>
          Client Dashboard
        </button>
      </div>

      {/* Quick Stats */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <h4 style={{
          margin: '0 0 15px 0',
          fontSize: '14px',
          fontWeight: '500',
          opacity: 0.9
        }}>
          Quick Actions
        </h4>
        <div style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6' }}>
          <div style={{ marginBottom: '8px' }}>✓ Create new client forms</div>
          <div style={{ marginBottom: '8px' }}>✓ View all client records</div>
          <div style={{ marginBottom: '8px' }}>✓ Search and filter clients</div>
          <div>✓ Manage client documents</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '20px',
        right: '20px',
        textAlign: 'center',
        fontSize: '12px',
        opacity: 0.6
      }}>
        CRM System v1.0
      </div>
    </div>
  );
};

export default Sidebar;