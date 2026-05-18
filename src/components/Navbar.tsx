import React, { useState, useRef, useEffect, useCallback } from "react";
import NotificationDropdown from "./NotificationDropdown";
import SyncStatusIndicator from "./SyncStatusIndicator";
import { authHeaders, getCsrfToken } from "../utils/authToken";

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
  const [activeUserCount, setActiveUserCount] = useState<number | null>(null);
  const [activeUserList, setActiveUserList] = useState<Array<{ fullName: string; email?: string; department?: string; position?: string; profileImageR2Path?: string }>>([]);
  const [showActiveDropdown, setShowActiveDropdown] = useState(false);
  const activeDropdownRef = useRef<HTMLDivElement>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Presence: heartbeat + active-user count poll ───────────────────────────
  const sendHeartbeat = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      await fetch('/.netlify/functions/track-presence', {
        method: 'POST',
        headers: {
          ...authHeaders(),
          ...(getCsrfToken() ? { 'X-CSRF-Token': getCsrfToken()! } : {}),
        },
        body: JSON.stringify({}),
      });
    } catch {
      // non-fatal — heartbeat failures are silently ignored
    }
  }, [isLoggedIn]);

  const pollActiveUsers = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const res = await fetch('/.netlify/functions/get-active-users', {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.count === 'number') setActiveUserCount(data.count);
        if (Array.isArray(data.users)) setActiveUserList(data.users);
      }
    } catch {
      // non-fatal
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    // Immediate first run
    sendHeartbeat();
    pollActiveUsers();
    // Heartbeat every 60 s, count poll every 30 s
    heartbeatTimerRef.current = setInterval(sendHeartbeat, 60_000);
    pollTimerRef.current = setInterval(pollActiveUsers, 30_000);
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isLoggedIn, sendHeartbeat, pollActiveUsers]);

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

  useEffect(() => {
    if (!showActiveDropdown) return;
    function handleClickOutside(e: MouseEvent) {
      if (activeDropdownRef.current && !activeDropdownRef.current.contains(e.target as Node)) {
        setShowActiveDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showActiveDropdown]);

  return (
  <nav style={{
    padding: "0 clamp(0.75rem, 3vw, 2rem)",
    background: "linear-gradient(135deg, #071f55 0%, #0A2D74 60%, #1a4a9e 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 1px 0 rgba(255,255,255,0.06), 0 4px 16px rgba(7, 31, 85, 0.4)",
    position: "sticky",
    top: 0,
    zIndex: 999,
    gap: "8px",
    height: "60px",
    borderBottom: "1px solid rgba(40, 162, 220, 0.2)"
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
          fontFamily: 'var(--font-sans)',
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
      }}>
        {/* Sync Status Indicator */}
        <SyncStatusIndicator />

        {/* Active Now badge — click to see who's online */}
        {activeUserCount !== null && (
          <div ref={activeDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowActiveDropdown(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: showActiveDropdown ? 'rgba(34, 197, 94, 0.18)' : 'rgba(34, 197, 94, 0.1)',
                border: '1px solid rgba(34, 197, 94, 0.25)',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: '500',
                color: '#86efac',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 6px #22c55e',
                  flexShrink: 0,
                }}
              />
              {activeUserCount} active now
            </button>

            {showActiveDropdown && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                minWidth: '220px',
                maxWidth: '280px',
                zIndex: 1001,
                overflow: 'hidden',
              }}>
                {/* Header */}
                <div style={{
                  padding: '10px 14px 8px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: '#22c55e', boxShadow: '0 0 5px #22c55e', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#0f172a' }}>
                    {activeUserCount} Online Now
                  </span>
                </div>

                {/* User list */}
                <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {activeUserList.length === 0 ? (
                    <div style={{ padding: '14px', fontSize: '13px', color: '#94a3b8', textAlign: 'center' }}>
                      No user details available
                    </div>
                  ) : (
                    activeUserList.map((u, i) => {
                      const initials = u.fullName
                        .split(' ')
                        .map(n => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase();
                      const r2BaseUrl = (window as any).__R2_PUBLIC_URL__ || import.meta.env.VITE_R2_PUBLIC_URL || '';
                      const avatarSrc = u.profileImageR2Path ? `${r2BaseUrl}/${u.profileImageR2Path}` : null;
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '9px 14px',
                            borderBottom: i < activeUserList.length - 1 ? '1px solid #f8fafc' : 'none',
                          }}
                        >
                          {/* Avatar */}
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: '#e0f2fe', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700, color: '#0369a1',
                            overflow: 'hidden', border: '1px solid #bae6fd',
                          }}>
                            {avatarSrc ? (
                              <img src={avatarSrc} alt={initials}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : initials}
                          </div>
                          {/* Info */}
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontSize: '13px', fontWeight: 600, color: '#0f172a',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {u.fullName}
                              {u.fullName === currentUser?.fullName && (
                                <span style={{ marginLeft: '5px', fontSize: '10px', color: '#64748b', fontWeight: 400 }}>
                                  (you)
                                </span>
                              )}
                            </div>
                            {(u.position || u.department) && (
                              <div style={{
                                fontSize: '11px', color: '#64748b',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {[u.position, u.department].filter(Boolean).join(' · ')}
                              </div>
                            )}
                          </div>
                          {/* Online dot */}
                          <div style={{
                            width: '7px', height: '7px', borderRadius: '50%',
                            background: '#22c55e', boxShadow: '0 0 4px #22c55e',
                            flexShrink: 0, marginLeft: 'auto',
                          }} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
