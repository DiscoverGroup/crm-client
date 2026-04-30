import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { authHeaders } from '../utils/authToken';
import type { ClientData } from '../services/clientService';
import { FileService } from '../services/fileService';
import type { FileAttachment } from '../services/fileService';
import { ActivityLogService } from '../services/activityLogService';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DriveFolder { id: string; name: string; }
interface DriveFile {
  id: string; name: string; size: number; mimeType: string; modifiedTime: string;
}
interface BreadcrumbItem { id: string; name: string; level: 'root' | 'route' | 'client'; }
interface RestoreResult { fileName: string; status: 'ok' | 'error'; error?: string; }

export interface DriveRestoreModalProps {
  visible: boolean;
  onClose: () => void;
  clients: ClientData[];
  onFilesRestored?: () => void;
  currentUser?: { fullName: string; username: string; id: string; email: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function mimeIcon(mime: string): string {
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('zip') || mime.includes('compressed')) return '🗜️';
  return '📎';
}

function generateId(): string {
  return `restored-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Main component ─────────────────────────────────────────────────────────────
const DriveRestoreModal: React.FC<DriveRestoreModalProps> = ({
  visible, onClose, clients, onFilesRestored, currentUser
}) => {
  const [view, setView] = useState<'browse' | 'restoring' | 'done'>('browse');
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Restore progress
  const [restoreTotal, setRestoreTotal] = useState(0);
  const [restoreCurrent, setRestoreCurrent] = useState('');
  const [restoreResults, setRestoreResults] = useState<RestoreResult[]>([]);

  // Current client context (when at client level)
  const [clientContext, setClientContext] = useState<{ id: string | null; name: string }>({ id: null, name: '' });
  // Manual client override when auto-match fails
  const [clientOverride, setClientOverride] = useState<string>('');
  // Destination field / source selector
  const [restoreSource, setRestoreSource] = useState<string>('other');
  const [restoreFileType, setRestoreFileType] = useState<string>('');

  // Per-source config: how to derive fileType and category for each restored file
  type SourceCfg =
    | { kind: 'other' }
    | { kind: 'fixed'; fileType: string; category?: FileAttachment['category'] }
    | { kind: 'auto-slot'; prefix: string }               // e.g. booking-confirmation-1, -2 …
    | { kind: 'sub-select'; options: { value: string; label: string }[] }
    | { kind: 'payment-index' };                          // visa/insurance/eta — uses category:deposit-slip + paymentIndex:0

  const FILE_TYPE_CONFIG: Record<string, SourceCfg> = {
    'other':              { kind: 'other' },
    'booking-confirmation':{ kind: 'auto-slot', prefix: 'booking-confirmation-' },
    'passport-info':      { kind: 'auto-slot', prefix: 'passport-', },
    'other-payment':      { kind: 'fixed', fileType: 'other-payment-attachment' },
    'account-relations':  { kind: 'fixed', fileType: 'after-sales-sc-attachment' },
    'first-payment': {
      kind: 'sub-select',
      options: [
        { value: 'first-payment-deposit', label: 'Deposit Slip' },
        { value: 'first-payment-receipt', label: 'Receipt' },
      ],
    },
    'sc-report': {
      kind: 'sub-select',
      options: [
        { value: 'after-visa-sc-attachment',       label: 'After Visa' },
        { value: 'pre-departure-sc-attachment',    label: 'Pre-Departure' },
        { value: 'post-departure-sc-attachment',   label: 'Post-Departure' },
      ],
    },
    'visa-service':      { kind: 'payment-index' },
    'insurance-service': { kind: 'payment-index' },
    'eta-service':       { kind: 'payment-index' },
    'payment-terms':     { kind: 'payment-index' },
    'approval-invoice':  { kind: 'other' },
    'booking-voucher':   { kind: 'other' },
  };

  const SOURCE_OPTIONS: { value: string; label: string }[] = [
    { value: 'other', label: 'General Attachments' },
    { value: 'booking-confirmation', label: 'Booking Confirmation' },
    { value: 'booking-voucher', label: 'Booking Voucher' },
    { value: 'approval-invoice', label: 'Approval / Invoice' },
    { value: 'first-payment', label: 'First Payment' },
    { value: 'other-payment', label: 'Other Payment' },
    { value: 'visa-service', label: 'Visa Service (Slot 1)' },
    { value: 'insurance-service', label: 'Insurance Service (Slot 1)' },
    { value: 'eta-service', label: 'ETA Service (Slot 1)' },
    { value: 'passport-info', label: 'Passport Info' },
    { value: 'sc-report', label: 'SC Report' },
    { value: 'account-relations', label: 'Account Relations' },
  ];

  const currentLevel: 'root' | 'route' | 'client' = breadcrumb.length === 0 ? 'root' : breadcrumb.length === 1 ? 'route' : 'client';
  // The effective clientId to use for restore — manual override takes priority
  const effectiveClientId = clientOverride || clientContext.id || null;

  const loadFolder = useCallback(async (folderId: string | null) => {
    setLoading(true);
    setError('');
    setFiles([]);
    setFolders([]);
    setSelected(new Set());
    try {
      const res = await fetch('/.netlify/functions/list-drive-folder', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(folderId ? { folderId } : {}),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load folder');
      setFolders(data.folders || []);
      setFiles(data.files || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load Drive folder');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load root when modal opens
  useEffect(() => {
    if (visible) {
      setBreadcrumb([]);
      setView('browse');
      setSelected(new Set());
      setRestoreResults([]);
      setRestoreSource('other');
      setRestoreFileType('');
      loadFolder(null);
    }
  }, [visible, loadFolder]);

  const navigateInto = (folder: DriveFolder) => {
    const newLevel: BreadcrumbItem['level'] = currentLevel === 'root' ? 'route' : 'client';
    const newBreadcrumb = [...breadcrumb, { id: folder.id, name: folder.name, level: newLevel }];
    setBreadcrumb(newBreadcrumb);

    // Match by contactName, clientNo, or id (handles CLT-xxx style folder names)
    const folderLower = folder.name.toLowerCase().trim();
    const match = clients.find(c =>
      c.contactName?.toLowerCase().trim() === folderLower ||
      c.clientNo?.toLowerCase().trim() === folderLower ||
      c.id?.toLowerCase().trim() === folderLower
    );
    setClientContext({ id: match?.id || null, name: folder.name });
    setClientOverride('');

    loadFolder(folder.id);
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index < 0) {
      // Root
      setBreadcrumb([]);
      setClientContext({ id: null, name: '' });
      setClientOverride('');
      loadFolder(null);
    } else {
      const newBreadcrumb = breadcrumb.slice(0, index + 1);
      setBreadcrumb(newBreadcrumb);
      setClientOverride('');
      const item = newBreadcrumb[index];
      const itemLower = item.name.toLowerCase().trim();
      const match = clients.find(c =>
        c.contactName?.toLowerCase().trim() === itemLower ||
        c.clientNo?.toLowerCase().trim() === itemLower ||
        c.id?.toLowerCase().trim() === itemLower
      );
      setClientContext({ id: match?.id || null, name: item.name });
      loadFolder(item.id);
    }
  };

  const toggleFile = (fileId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === files.length) setSelected(new Set());
    else setSelected(new Set(files.map(f => f.id)));
  };

  const handleRestore = async () => {
    const filesToRestore = files.filter(f => selected.has(f.id));
    if (filesToRestore.length === 0) return;

    setView('restoring');
    setRestoreTotal(filesToRestore.length);
    setRestoreCurrent('');
    setRestoreResults([]);

    const results: RestoreResult[] = [];
    // Track slot counters per source for auto-slot sources within this restore batch
    const slotCounters: Record<string, number> = {};

    for (const file of filesToRestore) {
      setRestoreCurrent(file.name);
      try {
        const res = await fetch('/.netlify/functions/restore-drive-file', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileId: file.id,
            fileName: file.name,
            mimeType: file.mimeType,
            clientId: effectiveClientId || clientContext.name || 'unknown',
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Restore failed');

        // Determine correct fileType and category based on source config
        const cfg = FILE_TYPE_CONFIG[restoreSource] ?? { kind: 'other' };
        let attachmentCategory: FileAttachment['category'] = 'other';
        let attachmentFileType: string | undefined;
        let attachmentPaymentIndex: number | undefined;

        if (cfg.kind === 'fixed') {
          attachmentFileType = cfg.fileType;
          if (cfg.category) attachmentCategory = cfg.category;
        } else if (cfg.kind === 'auto-slot') {
          // Find used slot numbers for THIS client+source only (not stale entries from other clients)
          const clientAttachments = effectiveClientId
            ? FileService.getFilesByClient(effectiveClientId).filter(a => a.source === restoreSource)
            : [];
          const usedSlots = new Set(
            clientAttachments.map(a => {
              const m = a.fileType?.match(/(\d+)(?:-attachment)?$/);
              return m ? parseInt(m[1]) : 0;
            })
          );
          // Also account for slots assigned earlier in this batch
          const batchCount = slotCounters[restoreSource] ?? 0;
          slotCounters[restoreSource] = batchCount + 1;
          // Find the lowest slot number not already used
          let slotNum = 1;
          while (usedSlots.has(slotNum) || slotNum <= batchCount) slotNum++;
          // passport-info uses "passport-{n}-attachment", others use prefix + n
          attachmentFileType = restoreSource === 'passport-info'
            ? `passport-${slotNum}-attachment`
            : `${cfg.prefix}${slotNum}`;
        } else if (cfg.kind === 'sub-select') {
          const subOptions = cfg.options;
          attachmentFileType = restoreFileType || subOptions[0]?.value;
        } else if (cfg.kind === 'payment-index') {
          attachmentCategory = 'deposit-slip';
          attachmentPaymentIndex = 0;
        }
        // kind === 'other': category='other', no fileType

        // Register in FileService (localStorage + MongoDB)
        const attachment: FileAttachment = {
          file: {
            id: generateId(),
            name: data.fileName,
            type: data.mimeType,
            size: data.size,
            data: data.publicUrl,
            uploadDate: new Date().toISOString(),
            r2Path: data.r2Path,
            isR2: true,
            storagePlatform: 'r2' as const,
          },
          category: attachmentCategory,
          clientId: effectiveClientId || undefined,
          source: restoreSource as FileAttachment['source'],
          fileType: attachmentFileType,
          paymentIndex: attachmentPaymentIndex,
        };

        // Save to localStorage + MongoDB via FileService (ensures proper sync signalling)
        try {
          FileService.addRestoredAttachment(attachment);
        } catch {}

        results.push({ fileName: file.name, status: 'ok' });

        // Activity log
        try {
          const resolvedClientId = effectiveClientId || clientContext.id || undefined;
          const resolvedClientName = clients.find(c => c.id === resolvedClientId)?.contactName || clientContext.name || 'Unknown';
          ActivityLogService.addLog({
            clientId: resolvedClientId || 'unknown',
            clientName: resolvedClientName,
            action: 'file_recovered',
            performedBy: currentUser?.fullName || currentUser?.username || 'System',
            performedByUser: currentUser?.fullName || currentUser?.username || 'System',
            details: `Restored from Google Drive: ${file.name}`,
          });
        } catch {}
      } catch (e: any) {
        results.push({ fileName: file.name, status: 'error', error: e.message });
      }
      setRestoreResults([...results]);
    }

    setRestoreCurrent('');
    setView('done');
    if (results.some(r => r.status === 'ok') && onFilesRestored) {
      onFilesRestored();
    }
  };

  if (!visible) return null;

  // Use restoreResults.length for live pct (restoreDone state update is async)
  const pct = restoreTotal > 0 ? Math.round((restoreResults.length / restoreTotal) * 100) : 0;
  const successCount = restoreResults.filter(r => r.status === 'ok').length;
  const errorCount = restoreResults.filter(r => r.status === 'error').length;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(3px)',
      padding: '16px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '16px',
        width: '600px', maxWidth: '96vw',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        fontFamily: "'Poppins', sans-serif",
        overflow: 'hidden',
      }}>
        {/* ── Header ── */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <span style={{ fontSize: '26px' }}>🔄</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0A2D74' }}>
              Restore from Google Drive
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Browse backup folders and restore files to R2 storage
            </p>
          </div>
          {view !== 'restoring' && (
            <button onClick={onClose} style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: '#f1f5f9', border: 'none', cursor: 'pointer',
              fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#64748b',
            }}>✕</button>
          )}
        </div>

        {/* ── Breadcrumb (browse mode) ── */}
        {view === 'browse' && (
          <div style={{
            padding: '10px 24px', background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', gap: '6px',
            flexWrap: 'wrap', fontSize: '13px',
          }}>
            <button onClick={() => navigateToBreadcrumb(-1)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: breadcrumb.length > 0 ? '#3b82f6' : '#94a3b8',
              fontWeight: '600', padding: '2px 4px', borderRadius: '4px',
              fontFamily: 'inherit',
            }}>
              📂 CRM-Backups
            </button>
            {breadcrumb.map((item, idx) => (
              <React.Fragment key={item.id}>
                <span style={{ color: '#94a3b8' }}>›</span>
                <button onClick={() => navigateToBreadcrumb(idx)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: idx === breadcrumb.length - 1 ? '#0A2D74' : '#3b82f6',
                  fontWeight: idx === breadcrumb.length - 1 ? '700' : '500',
                  padding: '2px 4px', borderRadius: '4px',
                  fontFamily: 'inherit',
                }}>
                  {item.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>

          {/* BROWSE VIEW */}
          {view === 'browse' && (
            <>
              {loading && (
                <div style={{ textAlign: 'center', padding: '48px', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>⏳</div>
                  Loading…
                </div>
              )}

              {error && (
                <div style={{
                  padding: '12px 16px', background: '#fef2f2', border: '1px solid #fca5a5',
                  borderRadius: '10px', color: '#dc2626', fontSize: '13px', marginBottom: '12px',
                }}>
                  ❌ {error}
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Client context notice — shown whenever files are present */}
                  {files.length > 0 && breadcrumb.length > 0 && (
                    <div style={{
                      padding: '10px 14px', background: effectiveClientId ? '#f0fdf4' : '#fffbeb',
                      border: `1px solid ${effectiveClientId ? '#86efac' : '#fcd34d'}`,
                      borderRadius: '10px', fontSize: '12px',
                      marginBottom: '12px',
                    }}>
                      {effectiveClientId ? (
                        <div style={{ color: '#166534', display: 'flex', gap: '8px' }}>
                          <span>✅</span>
                          <span>Files will be restored and linked to client <strong>{clients.find(c => c.id === effectiveClientId)?.contactName || clientContext.name}</strong>.</span>
                        </div>
                      ) : (
                        <>
                          <div style={{ color: '#92400e', display: 'flex', gap: '8px', marginBottom: '8px' }}>
                            <span>⚠️</span>
                            <span>Could not auto-match <strong>"{clientContext.name}"</strong> to a CRM client. Select one manually or restore without a client link.</span>
                          </div>
                          <select
                            value={clientOverride}
                            onChange={e => setClientOverride(e.target.value)}
                            style={{
                              width: '100%', padding: '6px 10px', borderRadius: '7px',
                              border: '1px solid #fcd34d', fontSize: '12px',
                              fontFamily: 'inherit', background: '#fff', color: '#1e293b',
                            }}
                          >
                            <option value=''>— Restore without client link —</option>
                            {clients
                              .filter(c => c.contactName)
                              .sort((a, b) => (a.contactName || '').localeCompare(b.contactName || ''))
                              .map(c => (
                                <option key={c.id} value={c.id}>{c.contactName}</option>
                              ))
                            }
                          </select>
                        </>
                      )}
                    </div>
                  )}

                  {/* Folders */}
                  {folders.length > 0 && (
                    <div style={{ marginBottom: files.length > 0 ? '16px' : 0 }}>
                      {currentLevel === 'root' && (
                        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Route Folders
                        </p>
                      )}
                      {currentLevel === 'route' && (
                        <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Client Folders
                        </p>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
                        {folders.map(folder => (
                          <button key={folder.id} onClick={() => navigateInto(folder)} style={{
                            padding: '12px 14px', background: '#f0f4ff',
                            border: '1px solid #c7d2fe', borderRadius: '10px',
                            cursor: 'pointer', textAlign: 'left',
                            transition: 'all 0.15s ease', fontSize: '13px',
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontFamily: 'inherit', color: '#1e3a8a',
                          }}
                          onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.borderColor = '#c7d2fe'; }}
                          >
                            <span style={{ fontSize: '18px' }}>📁</span>
                            <span style={{ fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Destination field selector — shown whenever files are present */}
                  {files.length > 0 && breadcrumb.length > 0 && (
                    <div style={{
                      padding: '10px 14px', background: '#f8fafc',
                      border: '1px solid #e2e8f0', borderRadius: '10px',
                      fontSize: '12px', marginBottom: '12px',
                    }}>
                      <label style={{ display: 'block', fontWeight: '700', color: '#374151', marginBottom: '6px' }}>
                        📁 Restore files into:
                      </label>
                      <select
                        value={restoreSource}
                        onChange={e => {
                          setRestoreSource(e.target.value);
                          setRestoreFileType('');
                        }}
                        style={{
                          width: '100%', padding: '7px 10px', borderRadius: '7px',
                          border: '1px solid #cbd5e1', fontSize: '12px',
                          fontFamily: 'inherit', background: '#fff', color: '#1e293b',
                        }}
                      >
                        {SOURCE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {/* Sub-type picker for sources with multiple slots */}
                      {(() => {
                        const cfg = FILE_TYPE_CONFIG[restoreSource];
                        if (!cfg || cfg.kind !== 'sub-select') return null;
                        return (
                          <select
                            value={restoreFileType || cfg.options[0]?.value}
                            onChange={e => setRestoreFileType(e.target.value)}
                            style={{
                              width: '100%', padding: '7px 10px', borderRadius: '7px',
                              border: '1px solid #cbd5e1', fontSize: '12px',
                              fontFamily: 'inherit', background: '#fff', color: '#1e293b',
                              marginTop: '6px',
                            }}
                          >
                            {cfg.options.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        );
                      })()}
                    </div>
                  )}

                  {/* Files list — shown at any folder depth where files exist */}
                  {files.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Files ({files.length})
                        </p>
                        <button onClick={toggleAll} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '12px', color: '#3b82f6', fontWeight: '600',
                          fontFamily: 'inherit',
                        }}>
                          {selected.size === files.length ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {files.map(file => (
                          <label key={file.id} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 14px',
                            background: selected.has(file.id) ? '#f0f9ff' : '#f8fafc',
                            border: `1px solid ${selected.has(file.id) ? '#7dd3fc' : '#e2e8f0'}`,
                            borderRadius: '10px', cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}>
                            <input
                              type="checkbox"
                              checked={selected.has(file.id)}
                              onChange={() => toggleFile(file.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0A2D74' }}
                            />
                            <span style={{ fontSize: '20px' }}>{mimeIcon(file.mimeType)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                                {formatBytes(file.size)} · {formatDate(file.modifiedTime)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {!loading && folders.length === 0 && files.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8', fontSize: '14px' }}>
                      <div style={{ fontSize: '36px', marginBottom: '8px' }}>📭</div>
                      This folder is empty.
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* RESTORING VIEW */}
          {view === 'restoring' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600' }}>
                  <span style={{ color: '#374151' }}>Restoring files…</span>
                  <span style={{ color: '#0A2D74' }}>{pct}%</span>
                </div>
                <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: 'linear-gradient(90deg, #0A2D74, #28A2DC)',
                    borderRadius: '99px', transition: 'width 0.3s ease',
                  }} />
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#94a3b8' }}>
                  {restoreResults.length} / {restoreTotal} files
                </p>
              </div>

              {restoreCurrent && (
                <div style={{
                  padding: '10px 14px', background: '#f0f4ff', borderRadius: '10px',
                  fontSize: '13px', color: '#1e3a8a', marginBottom: '16px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <span style={{ fontSize: '18px' }}>⏳</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{restoreCurrent}</span>
                </div>
              )}

              {restoreResults.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {restoreResults.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '8px 12px', borderRadius: '8px',
                      background: r.status === 'ok' ? '#f0fdf4' : '#fef2f2',
                      fontSize: '12px',
                      color: r.status === 'ok' ? '#16a34a' : '#dc2626',
                    }}>
                      <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</span>
                      {r.error && <span style={{ fontSize: '11px', opacity: 0.8 }}>{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DONE VIEW */}
          {view === 'done' && (
            <div style={{ padding: '8px 0' }}>
              <div style={{
                padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center',
                background: errorCount === 0 ? '#f0fdf4' : successCount === 0 ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${errorCount === 0 ? '#86efac' : successCount === 0 ? '#fca5a5' : '#fcd34d'}`,
              }}>
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {errorCount === 0 ? '✅' : successCount === 0 ? '❌' : '⚠️'}
                </div>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#1e293b' }}>
                  {errorCount === 0
                    ? `${successCount} file${successCount !== 1 ? 's' : ''} restored successfully!`
                    : successCount === 0
                    ? 'All files failed to restore.'
                    : `${successCount} restored, ${errorCount} failed.`
                  }
                </p>
                {clientContext.id && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
                    Linked to: <strong>{clientContext.name}</strong>
                  </p>
                )}
                {!clientContext.id && clientContext.name && (
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#b45309' }}>
                    ⚠️ Files stored without client link — reassign manually.
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
                {restoreResults.map((r, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: '8px',
                    background: r.status === 'ok' ? '#f0fdf4' : '#fef2f2',
                    fontSize: '12px',
                    color: r.status === 'ok' ? '#16a34a' : '#dc2626',
                  }}>
                    <span>{r.status === 'ok' ? '✅' : '❌'}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fileName}</span>
                    {r.error && <span style={{ fontSize: '11px', opacity: 0.8 }}>{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex', gap: '10px', justifyContent: 'flex-end',
          background: '#f8fafc',
        }}>
          {view === 'browse' && (
            <>
              <button onClick={onClose} style={{
                padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                color: '#475569', fontFamily: 'inherit',
              }}>
                Cancel
              </button>
              {files.length > 0 && (
                <button
                  onClick={handleRestore}
                  disabled={selected.size === 0}
                  style={{
                    padding: '9px 20px',
                    background: selected.size === 0 ? '#9ca3af' : '#0A2D74',
                    border: 'none', borderRadius: '8px',
                    cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
                    fontSize: '13px', fontWeight: '600', color: '#fff',
                    fontFamily: 'inherit',
                  }}
                >
                  🔄 Restore {selected.size > 0 ? `${selected.size} ` : ''}File{selected.size !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}

          {view === 'done' && (
            <>
              <button onClick={() => {
                // Reload first so attachments refresh, then the page will restore to the same form via sessionStorage
                window.location.reload();
              }} style={{
                padding: '9px 20px', background: '#f1f5f9', border: '1px solid #e2e8f0',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                color: '#475569', fontFamily: 'inherit',
              }}>
                ← Restore More
              </button>
              <button onClick={() => window.location.reload()} style={{
                padding: '9px 20px', background: '#0A2D74', border: 'none',
                borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                color: '#fff', fontFamily: 'inherit',
              }}>
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DriveRestoreModal;
