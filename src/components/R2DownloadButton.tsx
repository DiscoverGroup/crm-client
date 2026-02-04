import React, { useState } from 'react';
import { getSignedDownloadUrl } from '../services/r2UploadService';

interface R2DownloadButtonProps {
  url: string;
  fileName: string;
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
  url,
  fileName,
  r2Path,
  bucket = 'crm-uploads',
  className,
  style
}) => {
  const [isGeneratingUrl, setIsGeneratingUrl] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // First, try the public URL
      console.log('📥 Attempting download from public URL:', url);
      
      const response = await fetch(url, { method: 'HEAD' });
      
      if (response.ok) {
        // Public URL works, use it directly
        console.log('✅ Public URL accessible, downloading...');
        window.open(url, '_blank');
        return;
      }

      // Public URL failed, try Netlify function to generate signed URL
      if (r2Path) {
        console.log('⚠️ Public URL not accessible, using Netlify function...');
        setIsGeneratingUrl(true);
        
        const functionResponse = await fetch(`/.netlify/functions/download-file?path=${encodeURIComponent(r2Path)}`);
        const result = await functionResponse.json();
        
        if (result.success && result.url) {
          console.log('✅ Signed URL generated via Netlify function');
          window.open(result.url, '_blank');
        } else {
          throw new Error(result.error || 'Failed to generate download URL');
        }
      } else {
        throw new Error('File path not available for download');
      }
    } catch (error) {
      console.error('❌ Download failed:', error);
      alert('Failed to download file. Please ensure:\n1. R2 public access is enabled, OR\n2. R2 credentials are configured in Netlify\n\nContact administrator if the issue persists.');
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
