import React from 'react';
import { FileService, type StoredFile } from '../services/fileService';

interface FileViewerProps {
  file: StoredFile;
  onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose }) => {
  const handleDownload = () => {
    // For R2 files, the data is already a URL
    if (file.isR2) {
      const link = document.createElement('a');
      link.href = file.data;
      link.download = file.name;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // For base64 files, use the old method
      const downloadUrl = FileService.createDownloadUrl(file);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderFilePreview = () => {
    const fileUrl = file.isR2 ? file.data : file.data;
    
    if (file.type.startsWith('image/')) {
      return (
        <img
          src={fileUrl}
          alt={file.name}
          style={{
            maxWidth: '100%',
            maxHeight: '60vh',
            objectFit: 'contain',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
        />
      );
    } else if (file.type === 'application/pdf') {
      return (
        <iframe
          src={fileUrl}
          style={{
            width: '100%',
            height: '60vh',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}
          title={file.name}
        />
      );
    } else {
      return (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            color: '#6c757d'
          }}>
            📄
          </div>
          <h3 style={{ 
            margin: '0 0 8px 0',
            color: '#495057'
          }}>
            {file.name}
          </h3>
          <p style={{
            margin: '0 0 16px 0',
            color: '#6c757d',
            fontSize: '14px'
          }}>
            Preview not available for this file type
            {file.isR2 && <span style={{ display: 'block', marginTop: '8px' }}>📦 Stored in R2</span>}
          </p>
          <button
            onClick={handleDownload}
            style={{
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Download File
          </button>
        </div>
      );
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          position: 'relative',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: '1px solid #e9ecef'
        }}>
          <div>
            <h3 style={{
              margin: '0 0 4px 0',
              color: '#212529',
              fontSize: '18px'
            }}>
              {file.name}
            </h3>
            <div style={{
              display: 'flex',
              gap: '16px',
              fontSize: '14px',
              color: '#6c757d'
            }}>
              <span>Size: {FileService.formatFileSize(file.size)}</span>
              <span>Type: {file.type}</span>
              <span>Uploaded: {new Date(file.uploadDate).toLocaleDateString()}</span>
              {file.isR2 && <span style={{ color: '#28a745', fontWeight: '500' }}>📦 R2 Storage</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6c757d',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* File Preview */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: '20px'
        }}>
          {renderFilePreview()}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <button
            onClick={handleDownload}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            <span>📥</span>
            Download
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#5a6268'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileViewer;