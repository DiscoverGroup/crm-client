import React, { useState, useRef, useEffect } from "react";
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
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showActionsMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setShowActionsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActionsMenu]);

  return (
  <nav style={{
    padding: "0 clamp(0.75rem, 3vw, 2rem)",
    background: "linear-gradient(135deg, #071f55 0%, #0A2D74 60%, #1a4a9e 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 20px rgba(10, 45, 116, 0.35)",
    position: "sticky",
    top: 0,
    zIndex: 999,
    gap: "8px",
    height: "64px",
    borderBottom: "1px solid rgba(40, 162, 220, 0.3)",
    overflow: "hidden"
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
        flexShrink: 0,
        overflow: "hidden"
      }}>
        {/* Sync Status Indicator */}
        <SyncStatusIndicator />

        {/* Actions Dropdown (Users + Messaging) */}
        {(onOpenUserDirectory || onOpenMessaging) && (
          <div ref={actionsMenuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowActionsMenu(v => !v)}
              style={{
                background: showActionsMenu ? "rgba(40, 162, 220, 0.3)" : "rgba(40, 162, 220, 0.15)",
                color: "white",
                border: "1px solid rgba(40, 162, 220, 0.35)",
                padding: "7px 12px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "18px",
                transition: "all 0.2s ease",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                position: "relative",
              }}
            >
              ⋮
              {unreadMessageCount > 0 && (
                <span style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-6px",
                  background: "#ef4444",
                  color: "white",
                  borderRadius: "50%",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  fontWeight: "600",
                  border: "2px solid #0A2D74",
                }}>
                  {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                </span>
              )}
            </button>
            {showActionsMenu && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                background: "#0A2D74",
                border: "1px solid rgba(40, 162, 220, 0.35)",
                borderRadius: "10px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                minWidth: "160px",
                overflow: "hidden",
                zIndex: 1000,
              }}>
                {onOpenUserDirectory && (
                  <button
                    onClick={() => { setShowActionsMenu(false); onOpenUserDirectory(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(40,162,220,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    👥 Users
                  </button>
                )}
                {onOpenMessaging && (
                  <button
                    onClick={() => { setShowActionsMenu(false); onOpenMessaging(); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "12px 16px",
                      background: "transparent",
                      border: "none",
                      borderTop: "1px solid rgba(40,162,220,0.2)",
                      color: "white",
                      fontSize: "14px",
                      fontWeight: "500",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.15s",
                      position: "relative",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(40,162,220,0.2)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    💬 Messaging
                    {unreadMessageCount > 0 && (
                      <span style={{
                        marginLeft: "auto",
                        background: "#ef4444",
                        color: "white",
                        borderRadius: "999px",
                        padding: "1px 7px",
                        fontSize: "11px",
                        fontWeight: "700",
                      }}>
                        {unreadMessageCount > 9 ? "9+" : unreadMessageCount}
                      </span>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {currentUser && onNavigate && (
          <NotificationDropdown
            currentUser={currentUser}
            onNavigate={onNavigate}
          />
        )}

        {/* User info */}
        <div className="navbar-user-info" style={{
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
          className="navbar-logout-btn"
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
