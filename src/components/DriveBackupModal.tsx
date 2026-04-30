import React from 'react';
import { createPortal } from 'react-dom';

export interface DriveBackupModalProgress {
  clientIndex: number;   // 0-based current client index
  totalClients: number;
  clientName: string;
  routeName: string;
  fileIndex: number;     // 0-based current file within client
  totalFiles: number;
  currentFile: string;
}

interface Props {
  visible: boolean;
  status: 'running' | 'done' | 'error';
  progress: DriveBackupModalProgress | null;
  message: string;
  onClose: () => void;
}

const DriveBackupModal: React.FC<Props> = ({ visible, status, progress, message, onClose }) => {
  if (!visible) return null;

  const filePct = progress && progress.totalFiles > 0
    ? Math.round(((progress.fileIndex) / progress.totalFiles) * 100)
    : 0;

  const overallPct = progress
    ? Math.round(
        ((progress.clientIndex + (progress.totalFiles > 0 ? progress.fileIndex / progress.totalFiles : 0)) /
          progress.totalClients) * 100
      )
    : status === 'done' ? 100 : 0;

  const isDone = status === 'done' || status === 'error';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '16px',
        padding: '32px',
        width: '480px',
        maxWidth: '92vw',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        fontFamily: "'Poppins', sans-serif"
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <span style={{ fontSize: '28px' }}>📂</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0A2D74' }}>
              {isDone ? (status === 'done' ? 'Backup Complete' : 'Backup Finished with Errors') : 'Backing up to Google Drive…'}
            </h2>
            {!isDone && progress && (
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                {progress.routeName} → {progress.clientName}
              </p>
            )}
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>Overall Progress</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0A2D74' }}>{isDone ? 100 : overallPct}%</span>
          </div>
          <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${isDone ? 100 : overallPct}%`,
              background: status === 'error' ? '#ef4444' : 'linear-gradient(90deg, #0A2D74, #28A2DC)',
              borderRadius: '99px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          {progress && (
            <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
              Client {progress.clientIndex + 1} of {progress.totalClients}
            </p>
          )}
        </div>

        {/* Per-client file progress */}
        {progress && progress.totalFiles > 0 && !isDone && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>
                Files for <em>{progress.clientName}</em>
              </span>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#16a34a' }}>{filePct}%</span>
            </div>
            <div style={{ height: '7px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${filePct}%`,
                background: '#16a34a',
                borderRadius: '99px',
                transition: 'width 0.2s ease'
              }} />
            </div>
            <p style={{ margin: '5px 0 0', fontSize: '11px', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {progress.currentFile}
            </p>
          </div>
        )}

        {/* Route/client info rows */}
        {progress && !isDone && (
          <div style={{
            background: '#f0f4ff',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '12px',
            color: '#334155'
          }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <span style={{ color: '#64748b', minWidth: '60px' }}>Route:</span>
              <span style={{ fontWeight: '600', color: '#0A2D74' }}>{progress.routeName || '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ color: '#64748b', minWidth: '60px' }}>Client:</span>
              <span style={{ fontWeight: '600' }}>{progress.clientName}</span>
            </div>
          </div>
        )}

        {/* Result message */}
        {isDone && message && (
          <div style={{
            background: status === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${status === 'error' ? '#fca5a5' : '#86efac'}`,
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '20px',
            fontSize: '13px',
            color: status === 'error' ? '#dc2626' : '#16a34a',
            wordBreak: 'break-word'
          }}>
            {message}
          </div>
        )}

        {/* Close button — only when done */}
        {isDone && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '11px',
              background: '#0A2D74',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default DriveBackupModal;
