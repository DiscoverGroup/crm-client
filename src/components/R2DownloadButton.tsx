import React, { useState } from 'react';

interface R2DownloadButtonProps {
  url?: string;
  fileName?: string;
  r2Path?: string;
  bucket?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Smart download button that handles R2 file downloads with automatic fallback
 * If public URL fails, it generates a signed URL
 */
const R2DownloadButton: React.FC<R2DownloadButtonProps> = ({
  r2Path,
  className,
  style
}) => {
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!r2Path) {
      alert('File path not available for download');
      return;
    }

    try {
      console.log('📥 Generating secure download URL...');
      setIsGeneratingUrl(true);
      
      // Use Netlify function to generate signed URL (more reliable than public URL)
      const functionResponse = await fetch(`/.netlify/functions/download-file?path=${encodeURIComponent(r2Path)}`);
      const result = await functionResponse.json();
      
      if (result.success && result.url) {
        console.log('✅ Download URL generated, opening file...');
        window.open(result.url, '_blank');
      } else {
        throw new Error(result.error || 'Failed to generate download URL');
      }
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Failed to download file. Please ensure R2 credentials are configured in Netlify.\n\nContact administrator if the issue persists.');
    } finally {
      setIsGeneratingUrl(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isGeneratingUrl}
      className={className}
      style={{
        fontSize: "12px",
        color: "#3b82f6",
        textDecoration: "none",
        padding: "4px 8px",
        border: "1px solid #3b82f6",
        borderRadius: "4px",
        cursor: isGeneratingUrl ? "wait" : "pointer",
        backgroundColor: "white",
        opacity: isGeneratingUrl ? 0.6 : 1,
        ...style
      }}
      title={isGeneratingUrl ? "Generating download link..." : "Download file"}
    >
      {isGeneratingUrl ? 'Generating...' : 'Download'}
    </button>
  );
};

export default R2DownloadButton;
