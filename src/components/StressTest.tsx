import React, { useState, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────
interface EndpointConfig {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  requiresAuth: boolean;
  category: 'auth' | 'data' | 'messaging' | 'files';
}

interface RequestResult {
  endpoint: string;
  status: number;
  duration: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface TestRun {
  id: string;
  startedAt: string;
  endedAt?: string;
  config: {
    concurrency: number;
    totalRequests: number;
    endpoints: string[];
  };
  results: RequestResult[];
  isRunning: boolean;
}

interface StressTestProps {
  onClose: () => void;
}

// ─── Preset Endpoints ─────────────────────────────────────────
const AVAILABLE_ENDPOINTS: EndpointConfig[] = [
  { id: 'health', name: 'Health Check (DB)', method: 'POST', path: '/.netlify/functions/database', body: { collection: 'clients', operation: 'find', filter: {}, limit: 1 }, requiresAuth: true, category: 'data' },
  { id: 'get-clients', name: 'Get Clients', method: 'POST', path: '/.netlify/functions/database', body: { collection: 'clients', operation: 'find', filter: {} }, requiresAuth: true, category: 'data' },
  { id: 'get-conversations', name: 'Get Conversations', method: 'GET', path: '/.netlify/functions/get-conversations', requiresAuth: true, category: 'messaging' },
  { id: 'get-log-notes', name: 'Get Log Notes', method: 'POST', path: '/.netlify/functions/get-log-notes', body: { clientId: 'test' }, requiresAuth: true, category: 'data' },
  { id: 'login-test', name: 'Login (invalid creds)', method: 'POST', path: '/.netlify/functions/login', body: { email: 'stresstest@test.com', password: 'StressTest123!' }, requiresAuth: false, category: 'auth' },
  { id: 'create-indexes', name: 'Create Indexes', method: 'POST', path: '/.netlify/functions/create-indexes', requiresAuth: true, category: 'data' },
];

// ─── Helpers ──────────────────────────────────────────────────
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth_token') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#10b981';
  if (status >= 300 && status < 400) return '#f59e0b';
  if (status >= 400 && status < 500) return '#f97316';
  return '#ef4444';
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * (p / 100)) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Component ────────────────────────────────────────────────
const StressTest: React.FC<StressTestProps> = ({ onClose }) => {
  const [concurrency, setConcurrency] = useState(5);
  const [totalRequests, setTotalRequests] = useState(50);
  const [selectedEndpoints, setSelectedEndpoints] = useState<string[]>(['health']);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [liveResults, setLiveResults] = useState<RequestResult[]>([]);
  const [progress, setProgress] = useState(0);
  const [viewingRun, setViewingRun] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Toggle endpoint selection
  const toggleEndpoint = (id: string) => {
    setSelectedEndpoints(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  // Execute a single request
  const executeRequest = useCallback(async (endpoint: EndpointConfig): Promise<RequestResult> => {
    const start = performance.now();
    try {
      const headers = endpoint.requiresAuth ? getAuthHeaders() : { 'Content-Type': 'application/json' };
      const fetchOptions: RequestInit = {
        method: endpoint.method,
        headers,
        ...(endpoint.body && endpoint.method !== 'GET' ? { body: JSON.stringify(endpoint.body) } : {})
      };

      const response = await fetch(endpoint.path, fetchOptions);
      const duration = performance.now() - start;

      return {
        endpoint: endpoint.name,
        status: response.status,
        duration,
        success: response.ok,
        timestamp: Date.now()
      };
    } catch (error) {
      const duration = performance.now() - start;
      return {
        endpoint: endpoint.name,
        status: 0,
        duration,
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: Date.now()
      };
    }
  }, []);

  // Run the stress test
  const runTest = useCallback(async () => {
    if (selectedEndpoints.length === 0) return;

    abortRef.current = false;
    setIsRunning(true);
    setLiveResults([]);
    setProgress(0);

    const endpoints = AVAILABLE_ENDPOINTS.filter(e => selectedEndpoints.includes(e.id));
    const results: RequestResult[] = [];
    const runId = `run-${Date.now()}`;
    let completed = 0;

    // Create request queue
    const queue: EndpointConfig[] = [];
    for (let i = 0; i < totalRequests; i++) {
      queue.push(endpoints[i % endpoints.length]);
    }

    // Process queue with concurrency limit
    const workers = Array.from({ length: Math.min(concurrency, totalRequests) }, async () => {
      while (queue.length > 0 && !abortRef.current) {
        const endpoint = queue.shift();
        if (!endpoint) break;

        const result = await executeRequest(endpoint);
        results.push(result);
        completed++;

        // Update live results every few requests for performance
        if (completed % Math.max(1, Math.floor(concurrency / 2)) === 0 || completed === totalRequests) {
          setLiveResults([...results]);
          setProgress(Math.round((completed / totalRequests) * 100));
        }
      }
    });

    await Promise.all(workers);

    // Final update
    setLiveResults([...results]);
    setProgress(100);

    const testRun: TestRun = {
      id: runId,
      startedAt: new Date(results[0]?.timestamp || Date.now()).toISOString(),
      endedAt: new Date().toISOString(),
      config: {
        concurrency,
        totalRequests,
        endpoints: selectedEndpoints
      },
      results: [...results],
      isRunning: false
    };

    setTestRuns(prev => [testRun, ...prev].slice(0, 10)); // Keep last 10 runs
    setIsRunning(false);
  }, [selectedEndpoints, concurrency, totalRequests, executeRequest]);

  // Stop test
  const stopTest = () => {
    abortRef.current = true;
  };

  // ─── Stats Calculation ────────────────────────────────────
  const calculateStats = (results: RequestResult[]) => {
    if (results.length === 0) {
      return { total: 0, successful: 0, failed: 0, avgDuration: 0, minDuration: 0, maxDuration: 0, p50: 0, p95: 0, p99: 0, rps: 0, errorRate: 0, statusCodes: {} as Record<number, number> };
    }

    const durations = results.map(r => r.duration);
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    const timeSpan = results.length > 1
      ? (results[results.length - 1].timestamp - results[0].timestamp) / 1000
      : 1;

    const statusCodes: Record<number, number> = {};
    results.forEach(r => {
      statusCodes[r.status] = (statusCodes[r.status] || 0) + 1;
    });

    return {
      total: results.length,
      successful,
      failed,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      p99: percentile(durations, 99),
      rps: results.length / Math.max(timeSpan, 0.1),
      errorRate: (failed / results.length) * 100,
      statusCodes
    };
  };

  const currentStats = calculateStats(liveResults);
  const viewedRun = viewingRun ? testRuns.find(r => r.id === viewingRun) : null;
  const viewedStats = viewedRun ? calculateStats(viewedRun.results) : null;

  // ─── Response Time Histogram ──────────────────────────────
  const renderHistogram = (results: RequestResult[]) => {
    if (results.length === 0) return null;
    const durations = results.map(r => r.duration);
    const maxDur = Math.max(...durations);
    const bucketCount = 12;
    const bucketSize = Math.max(maxDur / bucketCount, 1);
    const buckets = Array.from({ length: bucketCount }, (_, i) => ({
      min: i * bucketSize,
      max: (i + 1) * bucketSize,
      count: 0
    }));
    durations.forEach(d => {
      const idx = Math.min(Math.floor(d / bucketSize), bucketCount - 1);
      buckets[idx].count++;
    });
    const maxCount = Math.max(...buckets.map(b => b.count), 1);

    return (
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', fontWeight: 600 }}>Response Time Distribution</h4>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120, padding: '0 4px' }}>
          {buckets.map((bucket, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 9, color: '#94a3b8' }}>{bucket.count}</span>
              <div
                style={{
                  width: '100%',
                  height: `${(bucket.count / maxCount) * 90}px`,
                  background: bucket.max < 500 ? 'linear-gradient(to top, #10b981, #34d399)' :
                    bucket.max < 2000 ? 'linear-gradient(to top, #f59e0b, #fbbf24)' :
                      'linear-gradient(to top, #ef4444, #f87171)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: bucket.count > 0 ? 4 : 0,
                  transition: 'height 0.3s ease'
                }}
              />
              <span style={{ fontSize: 8, color: '#94a3b8', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                {formatDuration(bucket.min)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Timeline Chart ───────────────────────────────────────
  const renderTimeline = (results: RequestResult[]) => {
    if (results.length === 0) return null;
    const startTime = results[0].timestamp;
    const endTime = results[results.length - 1].timestamp;
    const span = Math.max(endTime - startTime, 1);
    const chartWidth = 600;
    const chartHeight = 120;
    const maxDur = Math.max(...results.map(r => r.duration));

    return (
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', fontWeight: 600 }}>Response Timeline</h4>
        <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map(f => (
            <g key={f}>
              <line x1={0} y1={chartHeight * (1 - f)} x2={chartWidth} y2={chartHeight * (1 - f)} stroke="#e2e8f0" strokeDasharray="4" />
              <text x={4} y={chartHeight * (1 - f) - 2} fill="#94a3b8" fontSize={8}>{formatDuration(maxDur * f)}</text>
            </g>
          ))}
          {/* Data points */}
          {results.map((r, i) => {
            const x = ((r.timestamp - startTime) / span) * (chartWidth - 20) + 10;
            const y = chartHeight - (r.duration / maxDur) * (chartHeight - 20) - 10;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={2.5}
                fill={r.success ? '#10b981' : '#ef4444'}
                opacity={0.7}
              />
            );
          })}
        </svg>
      </div>
    );
  };

  // ─── Stats Cards ──────────────────────────────────────────
  const renderStatsCards = (stats: ReturnType<typeof calculateStats>) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12,
      marginBottom: 16
    }}>
      {[
        { label: 'Total Requests', value: stats.total, color: '#3b82f6', icon: '📊' },
        { label: 'Successful', value: stats.successful, color: '#10b981', icon: '✅' },
        { label: 'Failed', value: stats.failed, color: '#ef4444', icon: '❌' },
        { label: 'Avg Response', value: formatDuration(stats.avgDuration), color: '#8b5cf6', icon: '⏱️' },
        { label: 'P95 Latency', value: formatDuration(stats.p95), color: '#f59e0b', icon: '📈' },
        { label: 'Requests/sec', value: stats.rps.toFixed(1), color: '#06b6d4', icon: '🚀' },
        { label: 'Error Rate', value: `${stats.errorRate.toFixed(1)}%`, color: stats.errorRate > 10 ? '#ef4444' : '#10b981', icon: '⚠️' },
        { label: 'Min / Max', value: `${formatDuration(stats.minDuration)} / ${formatDuration(stats.maxDuration)}`, color: '#64748b', icon: '↕️' },
      ].map(({ label, value, color, icon }) => (
        <div key={label} style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          padding: '14px 16px',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );

  // ─── Status Code Breakdown ────────────────────────────────
  const renderStatusCodes = (stats: ReturnType<typeof calculateStats>) => {
    const entries = Object.entries(stats.statusCodes);
    if (entries.length === 0) return null;
    const total = stats.total;

    return (
      <div style={{ marginTop: 16 }}>
        <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', fontWeight: 600 }}>Status Code Breakdown</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.sort((a, b) => b[1] - a[1]).map(([code, count]) => (
            <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: 13,
                fontWeight: 700,
                color: getStatusColor(Number(code)),
                minWidth: 36
              }}>
                {code === '0' ? 'ERR' : code}
              </span>
              <div style={{ flex: 1, height: 20, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(count / total) * 100}%`,
                  background: getStatusColor(Number(code)),
                  borderRadius: 6,
                  transition: 'width 0.3s ease',
                  minWidth: count > 0 ? 4 : 0
                }} />
              </div>
              <span style={{ fontSize: 12, color: '#64748b', minWidth: 60, textAlign: 'right' }}>
                {count} ({((count / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Render ───────────────────────────────────────────────
  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '2px solid #e2e8f0'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, color: '#1e293b', fontWeight: 700 }}>
            🧪 API Stress Test
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Test endpoint performance with configurable concurrent requests
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '8px 16px',
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600
          }}
        >
          ← Back
        </button>
      </div>

      {/* Configuration Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginBottom: 24
      }}>
        {/* Left: Parameters */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#334155', fontWeight: 700 }}>⚙️ Test Configuration</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Concurrent Workers: <span style={{ color: '#3b82f6' }}>{concurrency}</span>
            </label>
            <input
              type="range"
              min={1}
              max={20}
              value={concurrency}
              onChange={e => setConcurrency(Number(e.target.value))}
              disabled={isRunning}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
              <span>1</span><span>5</span><span>10</span><span>15</span><span>20</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Total Requests: <span style={{ color: '#3b82f6' }}>{totalRequests}</span>
            </label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={totalRequests}
              onChange={e => setTotalRequests(Number(e.target.value))}
              disabled={isRunning}
              style={{ width: '100%', accentColor: '#3b82f6' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
              <span>10</span><span>100</span><span>250</span><span>500</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              onClick={runTest}
              disabled={isRunning || selectedEndpoints.length === 0}
              style={{
                flex: 1,
                padding: '12px 20px',
                background: isRunning || selectedEndpoints.length === 0
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                cursor: isRunning || selectedEndpoints.length === 0 ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                boxShadow: isRunning ? 'none' : '0 4px 12px rgba(59,130,246,0.3)',
                transition: 'all 0.2s'
              }}
            >
              {isRunning ? '⏳ Running...' : '🚀 Start Test'}
            </button>
            {isRunning && (
              <button
                onClick={stopTest}
                style={{
                  padding: '12px 20px',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(239,68,68,0.3)'
                }}
              >
                ⏹ Stop
              </button>
            )}
          </div>
        </div>

        {/* Right: Endpoint Selection */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#334155', fontWeight: 700 }}>🎯 Endpoints</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['auth', 'data', 'messaging', 'files'] as const).map(category => {
              const catEndpoints = AVAILABLE_ENDPOINTS.filter(e => e.category === category);
              if (catEndpoints.length === 0) return null;
              const categoryLabels = { auth: '🔐 Auth', data: '📦 Data', messaging: '💬 Messaging', files: '📁 Files' };
              return (
                <div key={category}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, marginTop: 4 }}>
                    {categoryLabels[category]}
                  </div>
                  {catEndpoints.map(endpoint => (
                    <label
                      key={endpoint.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: selectedEndpoints.includes(endpoint.id) ? '#eff6ff' : 'white',
                        border: `1px solid ${selectedEndpoints.includes(endpoint.id) ? '#93c5fd' : '#e2e8f0'}`,
                        borderRadius: 8,
                        cursor: isRunning ? 'not-allowed' : 'pointer',
                        marginBottom: 4,
                        transition: 'all 0.15s'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEndpoints.includes(endpoint.id)}
                        onChange={() => toggleEndpoint(endpoint.id)}
                        disabled={isRunning}
                        style={{ accentColor: '#3b82f6' }}
                      />
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: endpoint.method === 'GET' ? '#dcfce7' : endpoint.method === 'POST' ? '#dbeafe' : '#fef3c7',
                        color: endpoint.method === 'GET' ? '#166534' : endpoint.method === 'POST' ? '#1e40af' : '#92400e',
                      }}>
                        {endpoint.method}
                      </span>
                      <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>{endpoint.name}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {isRunning && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Progress</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{progress}%</span>
          </div>
          <div style={{ height: 8, background: '#e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
              borderRadius: 8,
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Live Results */}
      {liveResults.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b', fontWeight: 700 }}>
            {isRunning ? '📡 Live Results' : '📋 Test Results'}
          </h3>
          {renderStatsCards(currentStats)}
          {renderStatusCodes(currentStats)}
          {renderHistogram(liveResults)}
          {renderTimeline(liveResults)}
        </div>
      )}

      {/* Previous Runs */}
      {testRuns.length > 0 && (
        <div style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 20
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, color: '#1e293b', fontWeight: 700 }}>📜 Test History</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {testRuns.map(run => {
              const stats = calculateStats(run.results);
              return (
                <div
                  key={run.id}
                  onClick={() => setViewingRun(viewingRun === run.id ? null : run.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: viewingRun === run.id ? '#eff6ff' : '#f8fafc',
                    border: `1px solid ${viewingRun === run.id ? '#93c5fd' : '#e2e8f0'}`,
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {new Date(run.startedAt).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>
                      {stats.total} reqs
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      {run.config.concurrency} workers
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      ✅ {stats.successful}
                    </span>
                    {stats.failed > 0 && (
                      <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                        ❌ {stats.failed}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: '#8b5cf6', fontWeight: 600 }}>
                      avg {formatDuration(stats.avgDuration)}
                    </span>
                    <span style={{ fontSize: 12, color: '#06b6d4', fontWeight: 600 }}>
                      {stats.rps.toFixed(1)} rps
                    </span>
                    <span style={{ fontSize: 16 }}>{viewingRun === run.id ? '▲' : '▼'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed view of selected run */}
          {viewedRun && viewedStats && (
            <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, color: '#334155' }}>
                Run: {new Date(viewedRun.startedAt).toLocaleString()} — {viewedRun.config.concurrency} workers, {viewedStats.total} requests
              </h4>
              {renderStatsCards(viewedStats)}
              {renderStatusCodes(viewedStats)}
              {renderHistogram(viewedRun.results)}
              {renderTimeline(viewedRun.results)}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {liveResults.length === 0 && testRuns.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#f8fafc',
          borderRadius: 12,
          border: '2px dashed #e2e8f0'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
          <h3 style={{ color: '#64748b', margin: '0 0 8px', fontWeight: 600 }}>No Tests Run Yet</h3>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>
            Select endpoints and configure parameters above, then click "Start Test" to begin.
          </p>
        </div>
      )}
    </div>
  );
};

export default StressTest;
