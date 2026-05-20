/**
 * Token Refresh Metrics & Monitoring
 * 
 * Tracks token refresh operations to prove the system is working correctly.
 * Provides real-time assurance that users are not experiencing 401 errors.
 */

interface TokenMetric {
  timestamp: number;
  type: 'refresh_success' | 'refresh_failure' | 'grace_recovery' | 'forced_logout' | 'auth_401';
  details?: string;
}

interface TokenMetricsSummary {
  totalRefreshes: number;
  successfulRefreshes: number;
  failedRefreshes: number;
  graceRecoveries: number;
  forcedLogouts: number;
  auth401Errors: number;
  refreshSuccessRate: number;
  lastRefreshTime: string | null;
  sessionStartTime: string;
  sessionDurationMinutes: number;
}

const METRICS_KEY = 'crm_token_metrics';
const SESSION_START_KEY = 'crm_session_start';
const MAX_METRICS_STORED = 100; // Keep last 100 events

/**
 * Records a token refresh metric event
 */
export function recordTokenMetric(
  type: TokenMetric['type'],
  details?: string
): void {
  try {
    const metrics = getStoredMetrics();
    
    const newMetric: TokenMetric = {
      timestamp: Date.now(),
      type,
      details
    };
    
    metrics.push(newMetric);
    
    // Keep only last MAX_METRICS_STORED events
    if (metrics.length > MAX_METRICS_STORED) {
      metrics.splice(0, metrics.length - MAX_METRICS_STORED);
    }
    
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics));
    
    // Log to console for debugging
    console.log(`[TokenMetrics] ${type}`, details || '');
  } catch (error) {
    // Silent fail - metrics are nice-to-have, not critical
  }
}

/**
 * Gets stored metrics from localStorage
 */
function getStoredMetrics(): TokenMetric[] {
  try {
    const stored = localStorage.getItem(METRICS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Initializes session tracking
 */
export function initSessionTracking(): void {
  if (!localStorage.getItem(SESSION_START_KEY)) {
    localStorage.setItem(SESSION_START_KEY, new Date().toISOString());
  }
}

/**
 * Clears session tracking (on logout)
 */
export function clearSessionTracking(): void {
  localStorage.removeItem(SESSION_START_KEY);
  localStorage.removeItem(METRICS_KEY);
}

/**
 * Gets comprehensive metrics summary
 */
export function getTokenMetricsSummary(): TokenMetricsSummary {
  const metrics = getStoredMetrics();
  const sessionStart = localStorage.getItem(SESSION_START_KEY);
  
  const totalRefreshes = metrics.filter(m => 
    m.type === 'refresh_success' || m.type === 'refresh_failure'
  ).length;
  
  const successfulRefreshes = metrics.filter(m => 
    m.type === 'refresh_success'
  ).length;
  
  const failedRefreshes = metrics.filter(m => 
    m.type === 'refresh_failure'
  ).length;
  
  const graceRecoveries = metrics.filter(m => 
    m.type === 'grace_recovery'
  ).length;
  
  const forcedLogouts = metrics.filter(m => 
    m.type === 'forced_logout'
  ).length;
  
  const auth401Errors = metrics.filter(m => 
    m.type === 'auth_401'
  ).length;
  
  const refreshSuccessRate = totalRefreshes > 0 
    ? (successfulRefreshes / totalRefreshes) * 100 
    : 100;
  
  const lastRefresh = metrics
    .filter(m => m.type === 'refresh_success')
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  
  const sessionStartTime = sessionStart || new Date().toISOString();
  const sessionDurationMs = Date.now() - new Date(sessionStartTime).getTime();
  const sessionDurationMinutes = Math.floor(sessionDurationMs / (60 * 1000));
  
  return {
    totalRefreshes,
    successfulRefreshes,
    failedRefreshes,
    graceRecoveries,
    forcedLogouts,
    auth401Errors,
    refreshSuccessRate,
    lastRefreshTime: lastRefresh ? new Date(lastRefresh.timestamp).toISOString() : null,
    sessionStartTime,
    sessionDurationMinutes
  };
}

/**
 * Gets metrics for the last N minutes
 */
export function getRecentMetrics(minutes: number = 60): TokenMetric[] {
  const metrics = getStoredMetrics();
  const cutoff = Date.now() - (minutes * 60 * 1000);
  return metrics.filter(m => m.timestamp >= cutoff);
}

/**
 * Checks if system is healthy (no recent 401 errors or failed refreshes)
 */
export function isTokenSystemHealthy(): boolean {
  const recentMetrics = getRecentMetrics(30); // Last 30 minutes
  
  // No 401 errors in last 30 min
  const recent401s = recentMetrics.filter(m => m.type === 'auth_401').length;
  if (recent401s > 0) return false;
  
  // Refresh success rate >90% in last 30 min
  const recentRefreshes = recentMetrics.filter(m => 
    m.type === 'refresh_success' || m.type === 'refresh_failure'
  );
  
  if (recentRefreshes.length > 0) {
    const recentSuccesses = recentMetrics.filter(m => m.type === 'refresh_success').length;
    const successRate = (recentSuccesses / recentRefreshes.length) * 100;
    if (successRate < 90) return false;
  }
  
  return true;
}

/**
 * Exports metrics as CSV for analysis
 */
export function exportMetricsCSV(): string {
  const metrics = getStoredMetrics();
  
  let csv = 'Timestamp,Type,Details\n';
  
  metrics.forEach(m => {
    const timestamp = new Date(m.timestamp).toISOString();
    const type = m.type;
    const details = (m.details || '').replace(/,/g, ';'); // Escape commas
    csv += `${timestamp},${type},${details}\n`;
  });
  
  return csv;
}

/**
 * Downloads metrics as CSV file
 */
export function downloadMetricsCSV(): void {
  const csv = exportMetricsCSV();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `token-metrics-${new Date().toISOString()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Prints metrics summary to console (for debugging)
 */
export function printMetricsSummary(): void {
  const summary = getTokenMetricsSummary();
  
  console.log('═══════════════════════════════════════════════════');
  console.log('📊 TOKEN REFRESH METRICS SUMMARY');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Session Duration: ${summary.sessionDurationMinutes} minutes`);
  console.log(`Session Start: ${summary.sessionStartTime}`);
  console.log('───────────────────────────────────────────────────');
  console.log(`Total Refreshes: ${summary.totalRefreshes}`);
  console.log(`✅ Successful: ${summary.successfulRefreshes}`);
  console.log(`❌ Failed: ${summary.failedRefreshes}`);
  console.log(`Success Rate: ${summary.refreshSuccessRate.toFixed(1)}%`);
  console.log('───────────────────────────────────────────────────');
  console.log(`Grace Recoveries: ${summary.graceRecoveries}`);
  console.log(`Forced Logouts: ${summary.forcedLogouts}`);
  console.log(`401 Errors: ${summary.auth401Errors}`);
  console.log('───────────────────────────────────────────────────');
  console.log(`Last Refresh: ${summary.lastRefreshTime || 'Never'}`);
  console.log(`System Health: ${isTokenSystemHealthy() ? '✅ Healthy' : '⚠️ Issues Detected'}`);
  console.log('═══════════════════════════════════════════════════');
}
