import React from "react";
import { getFullVersion, getSecurityVersion } from "../config/version";

const Footer: React.FC = () => {

  return (
    <footer 
      style={{ 
        padding: "1rem", 
        background: "#222", 
        color: "#fff", 
        marginTop: "auto", 
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem"
      }}
    >
      <small>&copy; {new Date().getFullYear()} DiscoverGroup CRM System. All rights reserved.</small>
      <small style={{ opacity: 0.7, fontSize: "0.75rem" }}>
        Website: {getFullVersion()} • Security: v{getSecurityVersion()}
      </small>
    </footer>
  );
};

export default Footer;