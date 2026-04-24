import { useState, useMemo } from 'react';
import type { ClientData } from '../services/clientService';

interface Props {
  clients: ClientData[];
  onClientClick: (client: ClientData) => void;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function travelDateKey(client: ClientData): string {
  const s = client.travelStartDate || client.travelDate || '';
  const e = client.travelEndDate || '';
  return `${s}||${e}`;
}

function travelDateLabel(client: ClientData): string {
  const s = client.travelStartDate || client.travelDate || '';
  const e = client.travelEndDate || '';
  if (!s && !e) return 'No Travel Date';
  if (s && e) return `${formatDate(s)} – ${formatDate(e)}`;
  return formatDate(s) || formatDate(e);
}

// Sort travel date groups: "No Travel Date" last, then chronological
function sortTravelKey(key: string): number {
  if (key === '||') return Infinity;
  const start = key.split('||')[0];
  if (!start) return Infinity;
  const d = new Date(start);
  return isNaN(d.getTime()) ? Infinity : d.getTime();
}

export default function PackageGroupView({ clients, onClientClick }: Props) {
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  // Group: package -> travelDateKey -> clients[]
  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, ClientData[]>>();
    for (const c of clients) {
      const pkg = (c.packageName || '').trim() || 'No Package';
      const dk = travelDateKey(c);
      if (!map.has(pkg)) map.set(pkg, new Map());
      const dateMap = map.get(pkg)!;
      if (!dateMap.has(dk)) dateMap.set(dk, []);
      dateMap.get(dk)!.push(c);
    }
    // Sort packages alphabetically, "No Package" last
    const sorted = [...map.entries()].sort(([a], [b]) => {
      if (a === 'No Package') return 1;
      if (b === 'No Package') return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [clients]);

  const togglePackage = (pkg: string) => {
    setExpandedPackages(prev => {
      const next = new Set(prev);
      next.has(pkg) ? next.delete(pkg) : next.add(pkg);
      return next;
    });
  };

  const toggleDate = (key: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  if (grouped.length === 0) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '15px', background: '#fff', borderRadius: '14px', border: '1px solid rgba(10,45,116,0.1)' }}>
        No clients to display.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {grouped.map(([pkg, dateMap]) => {
        const isPkgOpen = expandedPackages.has(pkg);
        const totalClients = [...dateMap.values()].reduce((s, arr) => s + arr.length, 0);

        // Sort date groups chronologically
        const sortedDates = [...dateMap.entries()].sort(([a], [b]) => sortTravelKey(a) - sortTravelKey(b));

        return (
          <div key={pkg} style={{ borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(10,45,116,0.07)', border: '1px solid rgba(10,45,116,0.1)' }}>
            {/* Package header row */}
            <div
              onClick={() => togglePackage(pkg)}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto',
                alignItems: 'center',
                padding: '14px 20px',
                background: 'linear-gradient(135deg, #0A2D74 0%, #1a4a9e 100%)',
                cursor: 'pointer',
                userSelect: 'none',
                gap: 10,
              }}
            >
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '16px', fontWeight: '700', textAlign: 'center' }}>
                {isPkgOpen ? '∨' : '>'}
              </span>
              <span style={{ color: '#ffffff', fontWeight: '700', fontSize: '15px', letterSpacing: '0.02em' }}>
                {pkg}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: '20px', padding: '2px 12px', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                {totalClients} {totalClients === 1 ? 'client' : 'clients'}
              </span>
            </div>

            {/* Travel date groups */}
            {isPkgOpen && (
              <div style={{ background: '#f8fafc' }}>
                {sortedDates.map(([dk, groupClients]) => {
                  const label = groupClients[0] ? travelDateLabel(groupClients[0]) : 'No Travel Date';
                  const dateGroupKey = `${pkg}__${dk}`;
                  const isDateOpen = expandedDates.has(dateGroupKey);

                  return (
                    <div key={dk} style={{ borderTop: '1px solid rgba(10,45,116,0.07)' }}>
                      {/* Date sub-header */}
                      <div
                        onClick={() => toggleDate(dateGroupKey)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '36px 1fr auto',
                          alignItems: 'center',
                          padding: '11px 20px 11px 28px',
                          cursor: 'pointer',
                          background: isDateOpen ? '#eef3fb' : '#f8fafc',
                          userSelect: 'none',
                          transition: 'background 0.15s',
                          gap: 10,
                        }}
                        onMouseOver={e => (e.currentTarget.style.background = '#eef3fb')}
                        onMouseOut={e => (e.currentTarget.style.background = isDateOpen ? '#eef3fb' : '#f8fafc')}
                      >
                        <span style={{ color: '#64748b', fontSize: '13px', textAlign: 'center' }}>
                          {isDateOpen ? '∨' : '>'}
                        </span>
                        <span style={{ color: '#1e293b', fontWeight: '600', fontSize: '13px' }}>
                          {label}
                        </span>
                        <span style={{ background: '#dbeafe', color: '#1e40af', borderRadius: '20px', padding: '2px 10px', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {groupClients.length} {groupClients.length === 1 ? 'client' : 'clients'}
                        </span>
                      </div>

                      {/* Client rows */}
                      {isDateOpen && (
                        <div>
                          {/* Sub-table header */}
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', background: '#1e293b', padding: '7px 28px' }}>
                            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>#</span>
                            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Client Name</span>
                          </div>
                          {groupClients.map((client, idx) => (
                            <div
                              key={client.id}
                              onClick={() => onClientClick(client)}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '44px 1fr',
                                padding: '11px 28px',
                                borderTop: '1px solid rgba(10,45,116,0.06)',
                                background: idx % 2 === 0 ? '#ffffff' : '#f8faff',
                                cursor: 'pointer',
                                transition: 'background 0.12s',
                              }}
                              onMouseOver={e => (e.currentTarget.style.background = 'rgba(40,162,220,0.07)')}
                              onMouseOut={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#f8faff')}
                            >
                              <span style={{ color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>{idx + 1}</span>
                              <div>
                                <div style={{ color: '#0A2D74', fontWeight: '700', fontSize: '14px' }}>
                                  {(client.contactName || 'Unknown').toUpperCase()}
                                </div>
                                <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '1px' }}>
                                  {client.clientNo || '—'}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
