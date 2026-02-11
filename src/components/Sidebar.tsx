import React, { useState } from 'react';

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
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleNavigation = (callback: () => void) => {
    callback();
    if (onClose) onClose();
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      <div 
        className={`sidebar-container ${isOpen ? 'open' : ''}`}
        style={{
          width: isCollapsed ? '80px' : '280px',
          background: 'linear-gradient(180deg, #0d47a1 0%, #083d63 50%, #062e4a 100%)',
          color: 'white',
          padding: isCollapsed ? '16px' : '24px',
          height: '100vh',
          boxShadow: '4px 0 15px rgba(0,0,0,0.1)',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 10001,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRight: '2px solid rgba(251, 191, 36, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        {/* Logo and Title */}
        <button
          onClick={() => handleNavigation(onNavigateToClientRecords)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'white',
            padding: '0',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
          title="Go to Dashboard"
        >
          {!isCollapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              width: '100%'
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
              <div style={{ textAlign: 'left' }}>
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
          )}

          {isCollapsed && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%'
            }}>
              <img 
                src="/DG.jpg" 
                alt="DG" 
                style={{
                  width: '40px',
                  height: '40px',
                  objectFit: 'contain'
                }}
              />
            </div>
          )}
        </button>

        {/* Toggle Button */}
        <button
          onClick={toggleCollapse}
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: '2px solid rgba(255,255,255,0.3)',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            zIndex: 10002,
            transition: 'all 0.3s ease',
            padding: 0,
            flexShrink: 0
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          }}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation Menu */}
      <div style={{ marginBottom: '24px' }}>
        {!isCollapsed && (
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
        )}

        {/* Client Records Button */}
        <button
          onClick={() => handleNavigation(onNavigateToClientRecords)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
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
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Client Dashboard' : ''}
        >
          <span style={{ fontSize: '20px' }}>📋</span>
          {!isCollapsed && <span>Client Dashboard</span>}
        </button>

        {/* User Profile Button */}
        <button
          onClick={() => handleNavigation(onNavigateToProfile)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
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
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'My Profile' : ''}
        >
          <span style={{ fontSize: '20px' }}>👤</span>
          {!isCollapsed && <span>My Profile</span>}
        </button>

        {/* Deleted Clients Button */}
        <button
          onClick={() => handleNavigation(onNavigateToDeleted)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
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
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Deleted Clients' : ''}
        >
          <span style={{ fontSize: '20px' }}>🗑️</span>
          {!isCollapsed && <span>Deleted Clients</span>}
        </button>

        {/* Activity Log Button */}
        <button
          onClick={() => handleNavigation(onNavigateToActivityLog)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
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
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '12px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(251,191,36,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(251,191,36,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Activity Log' : ''}
        >
          <span style={{ fontSize: '20px' }}>📋</span>
          {!isCollapsed && <span>Activity Log</span>}
        </button>
      </div>

      {/* Quick Actions - Hide when collapsed */}
      {!isCollapsed && (
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
      )}

      {/* Admin Panel Button (conditionally rendered) */}
      {onNavigateToAdminPanel && (
        <button
          type="button"
          onClick={() => {
            console.log('🔘 Admin Panel button clicked!', onNavigateToAdminPanel);
            handleNavigation(onNavigateToAdminPanel);
          }}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            marginTop: '20px',
            marginBottom: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 4px 8px rgba(245, 158, 11, 0.3)',
            position: 'relative',
            zIndex: 100,
            pointerEvents: 'auto',
            minHeight: '50px',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 12px rgba(245, 158, 11, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
          }}
          title={isCollapsed ? 'Admin Panel' : ''}
        >
          <span style={{ fontSize: '18px' }}>👥</span>
          {!isCollapsed && <span>Admin Panel</span>}
        </button>
      )}

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: isCollapsed ? '8px' : '24px',
        right: isCollapsed ? '8px' : '24px',
        textAlign: 'center',
        fontSize: isCollapsed ? '10px' : '11px',
        opacity: 0.5,
        padding: isCollapsed ? '8px' : '16px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 1,
        pointerEvents: 'none'
      }}>
        {isCollapsed ? (
          <div style={{ fontSize: '12px' }}>v1.0</div>
        ) : (
          <>
            <div>DG-CRM System v1.0</div>
            <div style={{ marginTop: '4px', fontSize: '10px' }}>© 2026 Discover Group</div>
          </>
        )}
      </div>
    </div>
    </>
  );
};

export default Sidebar;