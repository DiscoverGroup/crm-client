import React, { useState, useEffect, useRef } from 'react';

export const PACKAGE_OPTIONS_KEY = 'crm_package_options';
const CLIENTS_STORAGE_KEY = 'crm_clients_data';

export function getPackageOptions(): string[] {
  try {
    const raw = localStorage.getItem(PACKAGE_OPTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePackageOptions(options: string[]): void {
  localStorage.setItem(PACKAGE_OPTIONS_KEY, JSON.stringify(options));
}

/** Collects unique non-empty packageName values from all client records in localStorage. */
export function getClientPackages(): string[] {
  try {
    const raw = localStorage.getItem(CLIENTS_STORAGE_KEY);
    const clients: any[] = raw ? JSON.parse(raw) : [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of clients) {
      const name = (c.packageName || '').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        result.push(name);
      }
    }
    return result.sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Builds the merged option list:
 *  1. Admin-configured packages (in their defined order)
 *  2. Packages found in existing client records that aren't already in the admin list
 * Returns { adminOpts, clientOpts } separately so we can render section headers.
 */
function buildOptions(adminOptions: string[]): { adminOpts: string[]; clientOpts: string[] } {
  const adminLower = new Set(adminOptions.map(o => o.toLowerCase()));
  const clientPkgs = getClientPackages().filter(p => !adminLower.has(p.toLowerCase()));
  return { adminOpts: adminOptions, clientOpts: clientPkgs };
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function PackageSelect({ value, onChange, placeholder = 'Select or type package name' }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [adminOptions, setAdminOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const reload = () => {
    const opts = getPackageOptions();
    setAdminOptions(opts);
    const { clientOpts } = buildOptions(opts);
    setClientOptions(clientOpts);
  };

  // Load options on mount and whenever dropdown opens
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (open) {
      reload();
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  // If current value is not in either list, pin it at the top so it is never lost
  const currentValueOrphaned =
    value &&
    !adminOptions.some(o => o.toLowerCase() === value.toLowerCase()) &&
    !clientOptions.some(o => o.toLowerCase() === value.toLowerCase());

  const filterOpts = (arr: string[]) =>
    search.trim() ? arr.filter(o => o.toLowerCase().includes(search.trim().toLowerCase())) : arr;

  const filteredAdmin = filterOpts(adminOptions);
  const filteredClient = filterOpts(clientOptions);
  const filteredOrphan = currentValueOrphaned && (!search.trim() || value.toLowerCase().includes(search.trim().toLowerCase())) ? [value] : [];

  const anyResults = filteredOrphan.length + filteredAdmin.length + filteredClient.length > 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const select = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setSearch('');
  };

  const triggerStyle: React.CSSProperties = {
    padding: '11px 14px',
    border: open ? '1.5px solid #3b82f6' : '1.5px solid #d1dbe8',
    borderRadius: '10px',
    fontSize: '15px',
    width: '100%',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: value ? '#1e293b' : '#94a3b8',
    fontFamily: "'Poppins', sans-serif",
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    userSelect: 'none' as const,
    minHeight: '44px',
    transition: 'border-color 0.15s',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger button */}
      <div onClick={() => setOpen(o => !o)} style={triggerStyle}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || placeholder}
        </span>
        <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: '#fff',
          border: '1.5px solid #d1dbe8',
          borderRadius: '10px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
          zIndex: 9999,
          overflow: 'hidden',
        }}>
          {/* Search bar */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Search packages..."
              style={{
                width: '100%',
                padding: '7px 10px',
                border: '1.5px solid #e2e8f0',
                borderRadius: '7px',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif",
                background: '#fff',
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setOpen(false); setSearch(''); }
                if (e.key === 'Enter' && search.trim()) {
                  const allOpts = [...filteredAdmin, ...filteredClient, ...filteredOrphan];
                  const exact = allOpts.find((o: string) => o.toLowerCase() === search.trim().toLowerCase());
                  select(exact ?? search.trim());
                }
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {/* Current value pinned at top if orphaned */}
            {filteredOrphan.map(opt => (
              <PackageOption key={`orphan-${opt}`} opt={opt} selected={opt === value} onSelect={select} />
            ))}

            {/* Admin-configured packages */}
            {filteredAdmin.length > 0 && (
              <>
                {filteredClient.length > 0 && (
                  <SectionHeader label="Configured Packages" />
                )}
                {filteredAdmin.map(opt => (
                  <PackageOption key={`admin-${opt}`} opt={opt} selected={opt === value} onSelect={select} />
                ))}
              </>
            )}

            {/* Packages from existing client records */}
            {filteredClient.length > 0 && (
              <>
                <SectionHeader label="Used by Existing Clients" />
                {filteredClient.map(opt => (
                  <PackageOption key={`client-${opt}`} opt={opt} selected={opt === value} onSelect={select} />
                ))}
              </>
            )}

            {/* Empty state */}
            {!anyResults && (
              <div style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'center' }}>
                {search.trim()
                  ? <span onClick={() => select(search.trim())} style={{ cursor: 'pointer', color: '#3b82f6', fontWeight: 600 }}>+ Use "{search.trim()}"</span>
                  : <span style={{ color: '#94a3b8' }}>No packages yet. Add them in Admin → Packages.</span>}
              </div>
            )}

            {/* Allow typing a brand-new value not in any list */}
            {search.trim() && !filterOpts([...adminOptions, ...clientOptions, ...(currentValueOrphaned ? [value] : [])]).some(o => o.toLowerCase() === search.trim().toLowerCase()) && (
              <div
                onClick={() => select(search.trim())}
                style={{ padding: '9px 14px', fontSize: '13px', cursor: 'pointer', color: '#3b82f6', fontWeight: 600, borderTop: '1px solid #f1f5f9', background: '#f8fafc', fontFamily: "'Poppins', sans-serif" }}
              >
                + Use "{search.trim()}"
              </div>
            )}
          </div>

          {/* Clear */}
          {value && (
            <div style={{ borderTop: '1px solid #f1f5f9', padding: '6px 10px', background: '#fafafa' }}>
              <div
                onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
                style={{ fontSize: '12px', color: '#ef4444', cursor: 'pointer', fontWeight: 600, textAlign: 'center', fontFamily: "'Poppins', sans-serif" }}
              >
                ✕ Clear selection
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ padding: '5px 14px 3px', fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', background: '#f8fafc', borderTop: '1px solid #f1f5f9', fontFamily: "'Poppins', sans-serif" }}>
      {label}
    </div>
  );
}

function PackageOption({ opt, selected, onSelect }: { opt: string; selected: boolean; onSelect: (o: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onSelect(opt)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '10px 14px',
        fontSize: '14px',
        cursor: 'pointer',
        background: selected ? '#eff6ff' : hovered ? '#f8fafc' : '#fff',
        color: selected ? '#1d4ed8' : '#1e293b',
        fontWeight: selected ? 600 : 400,
        borderBottom: '1px solid #f8fafc',
        fontFamily: "'Poppins', sans-serif",
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {selected && <span style={{ color: '#3b82f6', fontSize: 13 }}>✓</span>}
      {opt}
    </div>
  );
}
