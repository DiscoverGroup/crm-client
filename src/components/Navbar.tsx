import React from "react";
import NotificationDropdown from "./NotificationDropdown";

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
}) => (
  <nav style={{
    padding: "1rem clamp(1rem, 4vw, 2rem)",
    background: "linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #1e7bb8 75%, #fbbf24 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    position: "sticky",
    top: 0,
    zIndex: 999,
    flexWrap: "wrap",
    gap: "12px"
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      {/* Mobile Hamburger Menu */}
      {isLoggedIn && onToggleSidebar && (
        <button
          onClick={onToggleSidebar}
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            color: "white",
            padding: "8px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "20px",
            display: "none",
            alignItems: "center",
            justifyContent: "center",
            width: "40px",
            height: "40px"
          }}
          className="mobile-menu-btn"
        >
          ☰
        </button>
      )}
      <img 
        src="/DG.jpg" 
        alt="Discover Group Logo" 
        style={{
          width: "45px",
          height: "45px",
          objectFit: "contain"
        }}
      />
      <div>
        <h1 style={{ 
          margin: 0,
          fontSize: "clamp(16px, 4vw, 20px)",
          fontWeight: "600",
          letterSpacing: "0.5px"
        }}>
          DG-CRM
        </h1>
        <p style={{
          margin: 0,
          fontSize: "clamp(10px, 2vw, 11px)",
          opacity: 0.85,
          fontWeight: "400",
          display: "none"
        }}
        className="navbar-subtitle"
        >
          Discover Group CRM
        </p>
      </div>
    </div>
    
    {isLoggedIn && (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "clamp(8px, 2vw, 16px)",
        flexWrap: "wrap"
      }}>
        {/* User Directory Button */}
        {onOpenUserDirectory && (
          <button
            onClick={onOpenUserDirectory}
            style={{
              background: "rgba(255, 255, 255, 0.15)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              padding: "clamp(6px, 1.5vw, 8px) clamp(10px, 3vw, 16px)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "clamp(12px, 2.5vw, 14px)",
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
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
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
              background: "rgba(255, 255, 255, 0.15)",
              color: "white",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              padding: "8px 16px",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "20px",
              transition: "all 0.2s ease",
              backdropFilter: "blur(10px)",
              position: "relative"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
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
                border: "2px solid #0d47a1"
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
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontSize: "14px",
            opacity: 0.95,
            fontWeight: "500"
          }}>
            Welcome, {currentUser?.fullName}
          </div>
          <div style={{
            fontSize: "12px",
            opacity: 0.75,
            fontWeight: "400"
          }}>
            @{currentUser?.username}
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            padding: "8px 20px",
            borderRadius: "8px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "all 0.2s ease",
            backdropFilter: "blur(10px)"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Logout
        </button>
      </div>
    )}
  </nav>
);

export default Navbar;