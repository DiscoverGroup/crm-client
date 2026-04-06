import React from "react";
import NotificationDropdown from "./NotificationDropdown";
import SyncStatusIndicator from "./SyncStatusIndicator";

interface NavbarProps {
  isLoggedIn?: boolean;
  currentUser?: { fullName: string; username: string; id: string; email: string } | null;
  onLogout?: () => void;
  onNavigate?: (page: 'client-form' | 'activity-log' | 'log-notes', params?: any) => void;
  onOpenUserDirectory?: () => void;
  onOpenMessaging?: () => void;
  unreadMessageCount?: number;
  onToggleSidebar?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ 
  isLoggedIn, 
  currentUser, 
  onLogout, 
  onNavigate,
  onOpenUserDirectory,
  onOpenMessaging,
  unreadMessageCount = 0,
  onToggleSidebar
}) => {
  const companyLogo = localStorage.getItem('crm_company_logo') || '/DG.jpg';

  return (
  <nav style={{
    padding: "0 clamp(1rem, 4vw, 2rem)",
    background: "linear-gradient(135deg, #071f55 0%, #0A2D74 60%, #1a4a9e 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(10, 45, 116, 0.35)",
    position: "sticky",
    top: 0,
    zIndex: 999,
    flexWrap: "wrap",
    gap: "12px",
    height: "64px",
    borderBottom: "1px solid rgba(40, 162, 220, 0.3)"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {/* Mobile Hamburger Menu */}
      {isLoggedIn && onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          style={{
            background: "rgba(40, 162, 220, 0.15)",
            border: "1px solid rgba(40, 162, 220, 0.35)",
            color: "white",
            padding: "8px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "18px",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: "38px",
            height: "38px"
          }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
      )}
      {/* Logo */}
      <div style={{
        width: "40px",
        height: "40px",
        borderRadius: "10px",
        overflow: "hidden",
        border: "2px solid rgba(40, 162, 220, 0.5)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        flexShrink: 0,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <img
          src={companyLogo}
          alt="Discover Group Logo"
          style={{ width: "36px", height: "36px", objectFit: "contain" }}
          onError={(e) => { e.currentTarget.src = '/DG.jpg'; }}
        />
      </div>
      <div>
        <h1 style={{
          margin: 0,
          fontSize: "clamp(15px, 3.5vw, 18px)",
          fontWeight: "800",
          letterSpacing: "0.08em",
          fontFamily: "'Poppins', sans-serif",
          color: "#ffffff",
          textShadow: "0 1px 3px rgba(0,0,0,0.3)"
        }}>
          DG-CRM
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "clamp(9px, 2vw, 10px)",
            opacity: 0.7,
            fontWeight: "400",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#28A2DC",
            display: "none"
          }}
          className="navbar-subtitle"
        >
          Discover Group
        </p>
      </div>
    </div>

    {isLoggedIn && (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "clamp(6px, 1.5vw, 12px)",
        flexWrap: "wrap"
      }}>
        {/* Sync Status Indicator */}
        <SyncStatusIndicator />

        {/* User Directory Button */}
        {onOpenUserDirectory && (
          <button
            onClick={onOpenUserDirectory}
            style={{
              background: "rgba(40, 162, 220, 0.15)",
              color: "white",
              border: "1px solid rgba(40, 162, 220, 0.35)",
              padding: "clamp(6px, 1.5vw, 7px) clamp(10px, 3vw, 14px)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "clamp(12px, 2.5vw, 13px)",
              fontWeight: "500",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap"
            }}
            className="navbar-btn"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(40, 162, 220, 0.3)";
              e.currentTarget.style.borderColor = "rgba(40, 162, 220, 0.6)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(40, 162, 220, 0.15)";
              e.currentTarget.style.borderColor = "rgba(40, 162, 220, 0.35)";
            }}
          >
            👥 Users
          </button>
        )}

        {/* Messaging Button */}
        {onOpenMessaging && (
          <button
            onClick={onOpenMessaging}
            style={{
              background: "rgba(40, 162, 220, 0.15)",
              color: "white",
              border: "1px solid rgba(40, 162, 220, 0.35)",
              padding: "7px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "18px",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
              position: "relative"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(40, 162, 220, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(40, 162, 220, 0.15)";
            }}
            title="Messages"
          >
            💬
            {unreadMessageCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-6px",
                right: "-6px",
                background: "#ef4444",
                color: "white",
                borderRadius: "50%",
                width: "20px",
                height: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: "600",
                border: "2px solid #0A2D74"
              }}>
                {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
              </span>
            )}
          </button>
        )}

        {currentUser && onNavigate && (
          <NotificationDropdown
            currentUser={currentUser}
            onNavigate={onNavigate}
          />
        )}

        {/* User info */}
        <div style={{
          textAlign: 'right',
          borderLeft: "1px solid rgba(40, 162, 220, 0.3)",
          paddingLeft: "12px"
        }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffffff" }}>
            {currentUser?.fullName}
          </div>
          <div style={{ fontSize: "11px", color: "#28A2DC", fontWeight: "500" }}>
            @{currentUser?.username}
          </div>
        </div>

        <button
          onClick={onLogout}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            color: "#fca5a5",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "7px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "600",
            transition: "all 0.2s ease",
            letterSpacing: "0.02em"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
            e.currentTarget.style.color = "#ffffff";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
            e.currentTarget.style.color = "#fca5a5";
          }}
        >
          Logout
        </button>
      </div>
    )}
  </nav>
  );
};

export default Navbar;
