import React from "react";

interface NavbarProps {
  isLoggedIn?: boolean;
  currentUser?: string | null;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, currentUser, onLogout }) => (
  <nav style={{
    padding: "1rem 2rem",
    background: "linear-gradient(135deg, #0d47a1 0%, #1565a0 50%, #1e7bb8 75%, #fbbf24 100%)",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    position: "sticky",
    top: 0,
    zIndex: 999
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <div style={{
        width: "40px",
        height: "40px",
        background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
        borderRadius: "10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: "700",
        color: "#0d47a1",
        boxShadow: "0 4px 6px -1px rgba(251, 191, 36, 0.4)"
      }}>
        DG
      </div>
      <div>
        <h1 style={{ 
          margin: 0,
          fontSize: "20px",
          fontWeight: "600",
          letterSpacing: "0.5px"
        }}>
          DG-CRM
        </h1>
        <p style={{
          margin: 0,
          fontSize: "11px",
          opacity: 0.85,
          fontWeight: "400"
        }}>
          Discover Group CRM
        </p>
      </div>
    </div>
    
    {isLoggedIn && (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px"
      }}>
        <span style={{
          fontSize: "14px",
          opacity: 0.95,
          fontWeight: "500"
        }}>
          Welcome, {currentUser}
        </span>
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