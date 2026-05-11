import React from "react";
import { getFullVersion, getSecurityVersion } from "../config/version";
import Card from "./ui/Card";
import SectionLabel from "./ui/SectionLabel";

const Footer: React.FC = () => {

  return (
    <footer
      style={{
        marginTop: "auto",
        padding: "1rem 1rem 1.25rem",
        background: "var(--foreground)",
        color: "#fff"
      }}
    >
      <Card
        variant="soft"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
          borderColor: "rgba(255,255,255,0.12)",
          borderRadius: "14px",
          padding: "14px 16px",
          textAlign: "center",
          color: "rgba(255,255,255,0.9)"
        }}
      >
        <div style={{ marginBottom: "8px" }}>
          <SectionLabel pulse={false}>System Version</SectionLabel>
        </div>

        <small style={{ display: "block", fontSize: "0.92rem", marginBottom: "8px" }}>
          &copy; {new Date().getFullYear()} DiscoverGroup CRM System. All rights reserved.
        </small>

        <small style={{ opacity: 0.82, fontSize: "0.78rem", fontFamily: "var(--font-sans)" }}>
          Website: <span className="gradient-text" style={{ fontWeight: 700 }}>{getFullVersion()}</span>
          {" • "}
          Security: v{getSecurityVersion()}
        </small>
      </Card>
    </footer>
  );
};

export default Footer;