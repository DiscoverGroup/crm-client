import React from "react";

interface NavbarProps {
  isLoggedIn?: boolean;
  currentUser?: string | null;
  onLogout?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isLoggedIn, currentUser, onLogout }) => (
  <nav style={{
    padding: "1rem",
    background: "#1976d2",
    color: "#fff",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center"
  }}>
    <h1 style={{ margin: 0 }}>CRM System</h1>
    
    {isLoggedIn && (
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "16px"
      }}>
        <span style={{
          fontSize: "14px",
          opacity: 0.9
        }}>
          Welcome, {currentUser}
        </span>
        <button
          onClick={onLogout}
          style={{
            background: "rgba(255, 255, 255, 0.2)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            padding: "8px 16px",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
            transition: "all 0.3s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
          }}
        >
          Logout
        </button>
      </div>
    )}
  </nav>
);

export default Navbar;