import React, { useState, useEffect } from "react";

const Footer: React.FC = () => {
  const [version, setVersion] = useState<string>('');
  const [lastCommitDate, setLastCommitDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersionInfo = async () => {
      try {
        // Fetch package.json from GitHub to get version
        const packageResponse = await fetch(
          'https://raw.githubusercontent.com/DiscoverGroup/crm-client/main/package.json'
        );
        
        if (packageResponse.ok) {
          const packageData = await packageResponse.json();
          setVersion(packageData.version || '1.0.0');
        }

        // Fetch latest commit info
        const commitResponse = await fetch(
          'https://api.github.com/repos/DiscoverGroup/crm-client/commits/main'
        );
        
        if (commitResponse.ok) {
          const commitData = await commitResponse.json();
          const commitDate = new Date(commitData.commit.author.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          });
          setLastCommitDate(commitDate);
        }
      } catch (error) {
        // Fallback to default version if fetch fails
        setVersion('1.0.0');
      } finally {
        setLoading(false);
      }
    };

    fetchVersionInfo();
  }, []);

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
      <small>&copy; {new Date().getFullYear()} CRM System. All rights reserved.</small>
      {!loading && (
        <small style={{ opacity: 0.7, fontSize: "0.75rem" }}>
          {version && `Version ${version}`}
          {lastCommitDate && ` • Updated ${lastCommitDate}`}
        </small>
      )}
    </footer>
  );
};

export default Footer;