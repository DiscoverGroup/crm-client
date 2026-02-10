import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  onConfirm?: () => void;
  cancelText?: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  onConfirm,
  cancelText
}) => {
  if (!isOpen) return null;

  const getIconAndColor = () => {
    switch (type) {
      case 'success':
        return { icon: '✓', color: '#10b981', bgColor: '#d1fae5' };
      case 'error':
        return { icon: '✕', color: '#ef4444', bgColor: '#fee2e2' };
      case 'warning':
        return { icon: '⚠', color: '#f59e0b', bgColor: '#fef3c7' };
      default:
        return { icon: 'ℹ', color: '#3b82f6', bgColor: '#dbeafe' };
    }
  };

  const { icon, color, bgColor } = getIconAndColor();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        padding: window.innerWidth < 640 ? '16px' : '20px'
      }}
      onClick={(e) => {
        // Only close if clicking the backdrop, not the modal content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: window.innerWidth < 640 ? '12px' : '16px',
          padding: window.innerWidth < 640 ? '24px' : '32px',
          maxWidth: window.innerWidth < 640 ? '95vw' : '450px',
          width: '90%',
          maxHeight: '85vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          animation: 'modalSlideIn 0.3s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>
          {`
            @keyframes modalSlideIn {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>
        
        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: bgColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            fontWeight: 'bold',
            color: color,
            marginRight: '16px',
            flexShrink: 0
          }}>
            {icon}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '8px'
            }}>
              {title}
            </h3>
            <p style={{
              margin: 0,
              fontSize: '15px',
              color: '#6b7280',
              lineHeight: '1.6',
              whiteSpace: 'pre-wrap'
            }}>
              {message}
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '28px',
          flexWrap: 'wrap'
        }}>
          {cancelText && (
            <button
              onClick={onClose}
              style={{
                padding: window.innerWidth < 640 ? '12px 20px' : '10px 24px',
                borderRadius: '8px',
                border: '2px solid #e5e7eb',
                backgroundColor: 'white',
                color: '#6b7280',
                fontSize: window.innerWidth < 640 ? '14px' : '15px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flex: window.innerWidth < 640 ? '1' : 'initial',
                minWidth: window.innerWidth < 640 ? '0' : 'auto',
                touchAction: 'manipulation'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#f9fafb';
                e.currentTarget.style.borderColor = '#d1d5db';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.borderColor = '#e5e7eb';
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            style={{
              padding: window.innerWidth < 640 ? '12px 20px' : '10px 24px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: color,
              color: 'white',
              fontSize: window.innerWidth < 640 ? '14px' : '15px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 6px -1px ${color}40`,
              flex: window.innerWidth < 640 ? '1' : 'initial',
              minWidth: window.innerWidth < 640 ? '0' : 'auto',
              touchAction: 'manipulation'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 6px 8px -1px ${color}40`;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 4px 6px -1px ${color}40`;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
