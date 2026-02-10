import React from 'react';

interface SidebarProps {
  onNavigateToClientRecords: () => void;
  onNavigateToProfile: () => void;
  onNavigateToDeleted: () => void;
  onNavigateToActivityLog: () => void;
  onNavigateToAdminPanel?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNavigateToClientRecords, 
  onNavigateToProfile, 
  onNavigateToDeleted, 
  onNavigateToActivityLog, 
  onNavigateToAdminPanel,
  isOpen = false,
  onClose
}) => {
  const handleNavigation = (callback: () => void) => {
    callback();
    if (onClose) onClose();
  };

  return (
    <div 
      className={`sidebar-container ${isOpen ? 'open' : ''}`}
      style={{
        width: '280px',
        background: 'linear-gradient(180deg, #0d47a1 0%, #083d63 50%, #062e4a 100%)',
        color: 'white',
        padding: '24px',
        height: '100vh',
        boxShadow: '4px 0 15px rgba(0,0,0,0.1)',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 10001,
        overflowY: 'auto',
        borderRight: '2px solid rgba(251, 191, 36, 0.2)'
      }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <img 
            src="/DG.jpg" 
            alt="Discover Group Logo" 
            style={{
              width: '50px',
              height: '50px',
              objectFit: 'contain'
            }}
          />
          <div>
            <h2 style={{ 
              margin: '0 0 4px 0',
              fontSize: '20px',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              DG-CRM
            </h2>
            <p style={{ 
              margin: 0,
              opacity: 0.8,
              fontSize: '12px',
              fontWeight: '400'
            }}>
              Discover Group
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{
          margin: '0 0 16px 0',
          fontSize: '13px',
          fontWeight: '600',
          opacity: 0.7,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Navigation
        </h3>

        {/* Client Records Button */}
        <button
          onClick={() => handleNavigation(onNavigateToClientRecords)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          <span style={{ fontSize: '20px' }}>📋</span>
          <span>Client Dashboard</span>
        </button>

        {/* User Profile Button */}
        <button
          onClick={() => handleNavigation(onNavigateToProfile)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          <span style={{ fontSize: '20px' }}>👤</span>
          <span>My Profile</span>
        </button>

        {/* Deleted Clients Button */}
        <button
          onClick={() => handleNavigation(onNavigateToDeleted)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          <span style={{ fontSize: '20px' }}>🗑️</span>
          <span>Deleted Clients</span>
        </button>

        {/* Activity Log Button */}
        <button
          onClick={() => handleNavigation(onNavigateToActivityLog)}
          style={{
            width: '100%',
            padding: '14px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '8px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backdropFilter: 'blur(10px)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          <span style={{ fontSize: '20px' }}>📋</span>
          <span>Activity Log</span>
        </button>
      </div>

      {/* Quick Actions */}
      <div style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h4 style={{
          margin: '0 0 16px 0',
          fontSize: '13px',
          fontWeight: '600',
          opacity: 0.9,
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Quick Actions
        </h4>
        <div style={{ fontSize: '13px', opacity: 0.85, lineHeight: '1.8' }}>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Create new clients</span>
          </div>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>View client records</span>
          </div>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Search & filter</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#10b981' }}>✓</span>
            <span>Manage documents</span>
          </div>
        </div>
      </div>

      {/* Admin Panel Button (conditionally rendered) */}
      {onNavigateToAdminPanel && (
        <button
          onClick={() => {
            console.log('🔘 Admin Panel button clicked!', onNavigateToAdminPanel);
            handleNavigation(onNavigateToAdminPanel);
          }}
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '24px',
            right: '24px',
            width: 'calc(100% - 48px)',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 8px rgba(245, 158, 11, 0.3)',
            zIndex: 10002
          }}
        >
          <span style={{ fontSize: '18px' }}>👥</span>
          <span>Admin Panel</span>
        </button>
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '24px',
        right: '24px',
        textAlign: 'center',
        fontSize: '11px',
        opacity: 0.5,
        padding: '16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 10001
      }}>
        <div>DG-CRM System v1.0</div>
        <div style={{ marginTop: '4px', fontSize: '10px' }}>© 2026 Discover Group</div>
      </div>
    </div>
  );
};

export default Sidebar;