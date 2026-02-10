import React, { useState } from 'react';
import { FileService, type StoredFile, type FileAttachment } from '../services/fileService';
import { showErrorToast } from '../utils/toast';

interface FileAttachmentListProps {
  attachments: FileAttachment[];
  title?: string;
  showCategory?: boolean;
  allowDelete?: boolean;
  onFileDeleted?: (fileId: string) => void;
}

const FileAttachmentList: React.FC<FileAttachmentListProps> = ({ 
  attachments, 
  title = "File Attachments",
  showCategory = true,
  allowDelete = false,
  onFileDeleted
}) => {
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);

  const handleFileClick = async (file: StoredFile) => {
    // Direct download without preview
    if (file.r2Path) {
      // For R2 files, use the download function
      try {
        const response = await fetch('/.netlify/functions/download-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: file.r2Path })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.url) {
            window.open(result.url, '_blank');
          }
        }
      } catch (error) {
        // console.error('Download error:', error);
        showErrorToast('Failed to download file');
      }
    } else {
      // For base64 files
      const downloadUrl = FileService.createDownloadUrl(file);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (window.confirm('Are you sure you want to delete this file?')) {
      setDeletingFileId(fileId);
      try {
        const success = await FileService.deleteFile(fileId);
        if (success) {
          onFileDeleted?.(fileId);
        } else {
          showErrorToast('Failed to delete file. Please try again.');
        }
      } catch (error) {
        // console.error('Error deleting file:', error);
        showErrorToast('Error deleting file. Please try again.');
      } finally {
        setDeletingFileId(null);
      }
    }
  };

  const getCategoryIcon = (category: FileAttachment['category']) => {
    switch (category) {
      case 'deposit-slip': return '🧾';
      case 'receipt': return '📄';
      case 'other': return '📎';
      default: return '📄';
    }
  };

  const getCategoryColor = (category: FileAttachment['category']) => {
    switch (category) {
      case 'deposit-slip': return '#28a745';
      case 'receipt': return '#007bff';
      case 'other': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const getSourceLabel = (source?: FileAttachment['source']) => {
    switch (source) {
      case 'payment-terms': return 'Payment Terms';
      case 'visa-service': return 'Visa Service';
      case 'insurance-service': return 'Insurance Service';
      case 'eta-service': return 'ETA Service';
      default: return '';
    }
  };

  if (attachments.length === 0) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6c757d',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>📎</div>
        <p style={{ margin: 0 }}>No attachments uploaded yet</p>
      </div>
    );
  }

  return (
    <div>
      <h4 style={{
        margin: '0 0 16px 0',
        color: '#495057',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        {title} ({attachments.length})
      </h4>
      
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '12px'
      }}>
        {attachments.map((attachment, index) => (
          <div
            key={attachment.file.id || index}
            style={{
              border: '1px solid #e9ecef',
              borderRadius: '8px',
              padding: '16px',
              backgroundColor: 'white',
              transition: 'all 0.2s ease',
              cursor: 'pointer',
              position: 'relative'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#007bff';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,123,255,0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e9ecef';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={() => handleFileClick(attachment.file)}
          >
            {/* Category Badge with Source */}
            {showCategory && (
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                backgroundColor: getCategoryColor(attachment.category),
                color: 'white',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '500',
                textTransform: 'uppercase'
              }}>
                {attachment.category.replace('-', ' ')}
                {attachment.source && ` (${getSourceLabel(attachment.source).toUpperCase()})`}
              </div>
            )}

            {/* File Icon */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '12px'
            }}>
              <div style={{
                fontSize: '24px',
                marginRight: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                backgroundColor: '#f8f9fa',
                borderRadius: '6px'
              }}>
                {attachment.file.type.startsWith('image/') ? '🖼️' : 
                 attachment.file.type === 'application/pdf' ? '📄' : 
                 getCategoryIcon(attachment.category)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: '500',
                  color: '#212529',
                  fontSize: '14px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {attachment.file.name}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  marginTop: '2px'
                }}>
                  {FileService.formatFileSize(attachment.file.size)}
                </div>
              </div>
            </div>

            {/* Payment Info */}
            {(attachment.paymentIndex !== undefined || attachment.paymentType) && (
              <div style={{
                fontSize: '12px',
                color: '#6c757d',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>💳</span>
                {attachment.paymentType && (
                  <span style={{ textTransform: 'capitalize' }}>
                    {attachment.paymentType} Payment
                  </span>
                )}
                {attachment.paymentIndex !== undefined && (
                  <span>#{attachment.paymentIndex + 1}</span>
                )}
              </div>
            )}

            {/* Upload Date */}
            <div style={{
              fontSize: '11px',
              color: '#adb5bd',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>📅</span>
              {new Date(attachment.file.uploadDate).toLocaleDateString()}
            </div>

            {/* Delete Button */}
            {allowDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileDelete(attachment.file.id);
                }}
                disabled={deletingFileId === attachment.file.id}
                style={{
                  position: 'absolute',
                  top: '8px',
                  left: '8px',
                  padding: '4px',
                  backgroundColor: deletingFileId === attachment.file.id ? '#6c757d' : '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deletingFileId === attachment.file.id ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: deletingFileId === attachment.file.id ? 0.6 : 1
                }}
                title={deletingFileId === attachment.file.id ? 'Deleting...' : 'Delete file'}
              >
                {deletingFileId === attachment.file.id ? '⏳' : '×'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileAttachmentList;