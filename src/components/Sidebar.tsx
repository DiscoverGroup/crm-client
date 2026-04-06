import React, { useState } from 'react';

interface SidebarProps {
  onNavigateToClientRecords: () => void;
  onNavigateToProfile: () => void;
  onNavigateToDeleted: () => void;
  onNavigateToActivityLog: () => void;
  onNavigateToCalendar: () => void;
  onNavigateToAdminPanel?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  onNavigateToClientRecords, 
  onNavigateToProfile, 
  onNavigateToDeleted, 
  onNavigateToActivityLog, 
  onNavigateToCalendar,
  onNavigateToAdminPanel,
  isOpen = false,
  onClose
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

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
          background: 'linear-gradient(180deg, #071f55 0%, #0A2D74 50%, #1a4a9e 100%)',
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
          borderRight: '1px solid rgba(40, 162, 220, 0.25)',
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
                src={localStorage.getItem('crm_company_logo') || '/DG.jpg'}
                alt="Discover Group Logo" 
                onError={(e) => { e.currentTarget.src = '/DG.jpg'; }}
                style={{
                  width: '44px',
                  height: '44px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '1.5px solid rgba(40,162,220,0.4)',
                  background: '#fff',
                  padding: '2px'
                }}
              />
              <div style={{ textAlign: 'left' }}>
                <h2 style={{ 
                  margin: '0 0 4px 0',
                  fontSize: '18px',
                  fontWeight: '800',
                  letterSpacing: '0.08em',
                  fontFamily: "'Poppins', sans-serif"
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
                src={localStorage.getItem('crm_company_logo') || '/DG.jpg'}
                alt="DG"
                onError={(e) => { e.currentTarget.src = '/DG.jpg'; }}
                style={{
                  width: '38px',
                  height: '38px',
                  objectFit: 'contain',
                  borderRadius: '7px',
                  border: '1.5px solid rgba(40,162,220,0.4)',
                  background: '#fff',
                  padding: '2px'
                }}
              />
            </div>
          )}
        </button>

        {/* Toggle Button — hidden on mobile (hamburger in Navbar controls opening) */}
        <button
          onClick={toggleCollapse}
          className="sidebar-toggle-btn"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #28A2DC 0%, #1a85bd 100%)',
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
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 162, 220, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          }}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          )}
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
            padding: isCollapsed ? '12px 0' : '13px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '11px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(40,162,220,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(40,162,220,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Client Dashboard' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          {!isCollapsed && <span>Client Dashboard</span>}
        </button>

        {/* User Profile Button */}
        <button
          onClick={() => handleNavigation(onNavigateToProfile)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '13px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '11px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(40,162,220,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(40,162,220,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'My Profile' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
          {!isCollapsed && <span>My Profile</span>}
        </button>

        {/* Deleted Clients Button */}
        <button
          onClick={() => handleNavigation(onNavigateToDeleted)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '13px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '11px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(40,162,220,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(40,162,220,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Deleted Clients' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          {!isCollapsed && <span>Deleted Clients</span>}
        </button>

        {/* Activity Log Button */}
        <button
          onClick={() => handleNavigation(onNavigateToActivityLog)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '13px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '11px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(40,162,220,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(40,162,220,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Activity Log' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
          </svg>
          {!isCollapsed && <span>Activity Log</span>}
        </button>

        {/* Team Calendar Button */}
        <button
          onClick={() => handleNavigation(onNavigateToCalendar)}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '13px 16px',
            backgroundColor: 'rgba(255,255,255,0.15)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            marginBottom: '6px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '11px',
            backdropFilter: 'blur(10px)',
            whiteSpace: 'nowrap'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(40,162,220,0.2)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1.05)' : 'translateX(4px)';
            e.currentTarget.style.borderColor = 'rgba(40,162,220,0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.transform = isCollapsed ? 'scale(1)' : 'translateX(0)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          title={isCollapsed ? 'Team Calendar' : ''}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {!isCollapsed && <span>Team Calendar</span>}
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
            handleNavigation(onNavigateToAdminPanel);
          }}
          style={{
            width: '100%',
            padding: isCollapsed ? '12px 0' : '14px 16px',
            background: 'linear-gradient(135deg, #28A2DC 0%, #1a85bd 100%)',
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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
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