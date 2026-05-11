import React, { useState } from 'react';

interface SidebarProps {
  onNavigateToClientRecords: () => void;
  onNavigateToProfile: () => void;
  onNavigateToDeleted: () => void;
  onNavigateToArchived: () => void;
  onNavigateToActivityLog: () => void;
  onNavigateToCalendar: () => void;
  onNavigateToAdminPanel?: () => void;
  onOpenDriveRestore?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

type NavItem = {
  label: string;
  title: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: 'default' | 'warn' | 'success';
};

const Sidebar: React.FC<SidebarProps> = ({
  onNavigateToClientRecords,
  onNavigateToProfile,
  onNavigateToDeleted,
  onNavigateToArchived,
  onNavigateToActivityLog,
  onNavigateToCalendar,
  onNavigateToAdminPanel,
  onOpenDriveRestore,
  isOpen = false,
  onClose,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const handleNavigation = (callback: () => void) => {
    callback();
    if (onClose) onClose();
  };

  const navItems: NavItem[] = [
    {
      label: 'Dashboard',
      title: 'Client Dashboard',
      onClick: () => handleNavigation(onNavigateToClientRecords),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      label: 'Profile',
      title: 'My Profile',
      onClick: () => handleNavigation(onNavigateToProfile),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
    {
      label: 'Deleted',
      title: 'Deleted Clients',
      onClick: () => handleNavigation(onNavigateToDeleted),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      ),
      tone: 'warn',
    },
    {
      label: 'Archived',
      title: 'Archived Clients',
      onClick: () => handleNavigation(onNavigateToArchived),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
      ),
    },
    {
      label: 'Activity',
      title: 'Activity Log',
      onClick: () => handleNavigation(onNavigateToActivityLog),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      ),
    },
    {
      label: 'Calendar',
      title: 'Team Calendar',
      onClick: () => handleNavigation(onNavigateToCalendar),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
  ];

  if (onOpenDriveRestore) {
    navItems.push({
      label: 'Restore',
      title: 'Restore from Drive',
      onClick: () => {
        if (onClose) onClose();
        onOpenDriveRestore();
      },
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-3" />
        </svg>
      ),
      tone: 'success',
    });
  }

  const getToneStyle = (tone: NavItem['tone']): React.CSSProperties => {
    if (tone === 'warn') return { color: '#a16207' };
    if (tone === 'success') return { color: '#047857' };
    return { color: '#334155' };
  };

  return (
    <>
      <div
        className={`sidebar-container ${isOpen ? 'open' : ''}`}
        style={{
          width: isCollapsed ? '80px' : '272px',
          background: 'rgba(255, 255, 255, 0.95)',
          color: '#0f172a',
          padding: isCollapsed ? '14px 10px' : '18px 14px',
          height: '100vh',
          boxShadow: '8px 0 30px rgba(15, 23, 42, 0.10)',
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 10001,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRight: '1px solid #e2e8f0',
          transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            marginBottom: '18px',
            paddingBottom: '14px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <button
            onClick={() => handleNavigation(onNavigateToClientRecords)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#0f172a',
              padding: 0,
              textAlign: 'left',
            }}
            title="Go to Dashboard"
          >
            <img
              src={localStorage.getItem('crm_company_logo') || '/DG.jpg'}
              alt="DG"
              onError={(e) => {
                e.currentTarget.src = '/DG.jpg';
              }}
              style={{
                width: isCollapsed ? '34px' : '38px',
                height: isCollapsed ? '34px' : '38px',
                objectFit: 'contain',
                borderRadius: '10px',
                border: '1px solid #dbe7ff',
                background: '#f8fbff',
                padding: '2px',
              }}
            />
            {!isCollapsed && (
              <div>
                <h2
                  style={{
                    margin: '0 0 2px 0',
                    fontSize: '16px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                  }}
                >
                  DG-CRM
                </h2>
                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Discover Group</p>
              </div>
            )}
          </button>

          <button
            onClick={() => setIsCollapsed((v) => !v)}
            className="sidebar-toggle-btn"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '9px',
              background: '#f1f5f9',
              border: '1px solid #dbe4f0',
              color: '#334155',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
              padding: 0,
              flexShrink: 0,
            }}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        <div style={{ marginBottom: '16px' }}>
          {navItems.map((item) => (
            <button
              key={item.title}
              onClick={item.onClick}
              style={{
                width: '100%',
                padding: isCollapsed ? '11px 0' : '11px 12px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '8px',
                transition: 'all 0.16s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: '10px',
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
                ...getToneStyle(item.tone),
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = isCollapsed ? 'scale(1.03)' : 'translateX(2px)';
                e.currentTarget.style.borderColor = '#cdd8e8';
                e.currentTarget.style.background = '#f8fbff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = '#e2e8f0';
                e.currentTarget.style.background = '#ffffff';
              }}
              title={isCollapsed ? item.title : ''}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </div>

        {onNavigateToAdminPanel && (
          <button
            type="button"
            onClick={() => handleNavigation(onNavigateToAdminPanel)}
            style={{
              width: '100%',
              padding: isCollapsed ? '11px 0' : '12px 14px',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#f8fafc',
              border: '1px solid #0f172a',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s ease',
              marginTop: '6px',
              marginBottom: '90px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '9px',
            }}
            title={isCollapsed ? 'Admin Panel' : ''}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            {!isCollapsed && <span>Admin Panel</span>}
          </button>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: isCollapsed ? '8px' : '14px',
            right: isCollapsed ? '8px' : '14px',
            textAlign: 'center',
            fontSize: isCollapsed ? '10px' : '11px',
            color: '#94a3b8',
            padding: isCollapsed ? '6px' : '12px',
            borderTop: '1px solid #e2e8f0',
            pointerEvents: 'none',
          }}
        >
          {!isCollapsed && (
            <>
              <div>DG-CRM Workspace</div>
              <div>2026 Discover Group</div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;
