import React, { useState, useEffect } from 'react';
import type { MonitoringDashboard } from '../types/monitoring';
import monitoringService from '../services/monitoringService';

interface SystemMonitoringProps {
  onClose: () => void;
}

const SystemMonitoring: React.FC<SystemMonitoringProps> = ({ onClose }) => {
  const [dashboard, setDashboard] = useState<MonitoringDashboard | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'performance' | 'anomalies' | 'consistency'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadDashboard();
    
    if (autoRefresh) {
      const interval = setInterval(loadDashboard, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadDashboard = () => {
    const data = monitoringService.getDashboard();
    setDashboard(data);
  };

  const handleResolveError = (errorId: string) => {
    const notes = prompt('Add resolution notes (optional):');
    monitoringService.resolveError(errorId, notes || undefined);
    loadDashboard();
  };

  const handleResolveAnomaly = (anomalyId: string) => {
    monitoringService.resolveAnomaly(anomalyId);
    loadDashboard();
  };

  const handleExportLogs = () => {
    const logs = monitoringService.exportLogs();
    const blob = new Blob([logs], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm-monitoring-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all monitoring logs? This cannot be undone.')) {
      monitoringService.clearAllLogs();
      loadDashboard();
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: '#dc2626',
      high: '#ea580c',
      medium: '#f59e0b',
      low: '#84cc16'
    };
    return colors[severity] || '#6b7280';
  };

  const getHealthStatus = () => {
    if (!dashboard) return { label: 'Unknown', color: '#6b7280' };
    
    const { systemHealth } = dashboard;
    if (systemHealth.criticalErrors > 0) {
      return { label: 'Critical', color: '#dc2626' };
    } else if (systemHealth.totalErrors > 10) {
      return { label: 'Warning', color: '#f59e0b' };
    } else if (systemHealth.successRate < 95) {
      return { label: 'Degraded', color: '#ea580c' };
    } else {
      return { label: 'Healthy', color: '#22c55e' };
    }
  };

  if (!dashboard) {
    return <div>Loading monitoring data...</div>;
  }

  const healthStatus = getHealthStatus();

  return (
    <div style={{
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
      backdropFilter: 'blur(4px)'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '95%',
        maxWidth: '1400px',
        height: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '24px',
          borderBottom: '2px solid #e9ecef',
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700' }}>
                🔍 System Monitoring & Error Detection
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', opacity: 0.9 }}>
                Real-time monitoring, error tracking, and anomaly detection
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                Auto-refresh
              </label>
              <button
                onClick={handleExportLogs}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                📥 Export
              </button>
              <button
                onClick={handleClearLogs}
                style={{
                  padding: '8px 16px',
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                🗑️ Clear
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '40px',
                  height: '40px',
                  cursor: 'pointer',
                  fontSize: '20px',
                  color: 'white'
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '8px',
          padding: '16px 24px',
          borderBottom: '1px solid #e9ecef',
          background: '#f8f9fa'
        }}>
          {(['overview', 'errors', 'performance', 'anomalies', 'consistency'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: '8px',
                background: activeTab === tab ? 'white' : 'transparent',
                color: activeTab === tab ? '#ef4444' : '#6b7280',
                fontWeight: activeTab === tab ? '600' : '500',
                cursor: 'pointer',
                fontSize: '14px',
                boxShadow: activeTab === tab ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                textTransform: 'capitalize'
              }}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'errors' && `❌ Errors (${dashboard.recentErrors.filter(e => !e.resolved).length})`}
              {tab === 'performance' && `⚡ Performance (${dashboard.performanceMetrics.filter(m => m.exceedsThreshold).length})`}
              {tab === 'anomalies' && `🚨 Anomalies (${dashboard.dataAnomalies.length})`}
              {tab === 'consistency' && `🔄 Consistency (${dashboard.consistencyChecks.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              {/* System Health */}
              <div style={{
                background: 'white',
                border: '2px solid #e9ecef',
                borderRadius: '12px',
                padding: '24px',
                marginBottom: '24px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>System Health</h3>
                  <div style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: healthStatus.color,
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '14px'
                  }}>
                    {healthStatus.label}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#fef2f2', borderRadius: '8px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#dc2626' }}>
                      {dashboard.systemHealth.totalErrors}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Total Errors (24h)</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#fef3c7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#f59e0b' }}>
                      {dashboard.systemHealth.averageResponseTime}ms
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Avg Response Time</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#dbeafe', borderRadius: '8px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#3b82f6' }}>
                      {dashboard.systemHealth.memoryUsage}MB
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Memory Usage</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px', background: '#dcfce7', borderRadius: '8px' }}>
                    <div style={{ fontSize: '32px', fontWeight: '700', color: '#22c55e' }}>
                      {dashboard.systemHealth.successRate}%
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>Success Rate</div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div style={{
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                    ❌ Recent Errors
                  </h4>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#dc2626' }}>Critical: </span>
                      {dashboard.recentErrors.filter(e => e.severity === 'critical' && !e.resolved).length}
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', color: '#ea580c' }}>High: </span>
                      {dashboard.recentErrors.filter(e => e.severity === 'high' && !e.resolved).length}
                    </div>
                    <div>
                      <span style={{ fontWeight: '600', color: '#f59e0b' }}>Medium: </span>
                      {dashboard.recentErrors.filter(e => e.severity === 'medium' && !e.resolved).length}
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                    🚨 Active Anomalies
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                    {dashboard.dataAnomalies.length}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Detected abnormal patterns
                  </div>
                </div>

                <div style={{
                  background: 'white',
                  border: '1px solid #e9ecef',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
                    🔄 Data Issues
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                    {dashboard.consistencyChecks.length}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                    Consistency problems found
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dashboard.recentErrors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                    <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>No errors detected</p>
                  </div>
                ) : (
                  dashboard.recentErrors.map(error => (
                    <div key={error.id} style={{
                      background: 'white',
                      border: `2px solid ${getSeverityColor(error.severity)}`,
                      borderRadius: '12px',
                      padding: '16px',
                      opacity: error.resolved ? 0.5 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              background: getSeverityColor(error.severity),
                              color: 'white'
                            }}>
                              {error.severity.toUpperCase()}
                            </span>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '500',
                              background: '#f3f4f6',
                              color: '#6b7280'
                            }}>
                              {error.category.replace(/_/g, ' ')}
                            </span>
                            {error.resolved && (
                              <span style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600',
                                background: '#dcfce7',
                                color: '#22c55e'
                              }}>
                                ✓ RESOLVED
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                            {error.message}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {new Date(error.timestamp).toLocaleString()}
                            {error.componentName && ` • ${error.componentName}`}
                            {error.userEmail && ` • ${error.userEmail}`}
                          </div>
                          {error.stack && (
                            <details style={{ marginTop: '8px', fontSize: '11px' }}>
                              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>View stack trace</summary>
                              <pre style={{
                                marginTop: '8px',
                                padding: '8px',
                                background: '#f3f4f6',
                                borderRadius: '4px',
                                overflow: 'auto',
                                maxHeight: '200px'
                              }}>
                                {error.stack}
                              </pre>
                            </details>
                          )}
                        </div>
                        {!error.resolved && (
                          <button
                            onClick={() => handleResolveError(error.id)}
                            style={{
                              padding: '6px 12px',
                              background: '#22c55e',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dashboard.performanceMetrics.filter(m => m.exceedsThreshold).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚡</div>
                    <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>No performance issues detected</p>
                  </div>
                ) : (
                  dashboard.performanceMetrics.filter(m => m.exceedsThreshold).map(metric => (
                    <div key={metric.id} style={{
                      background: 'white',
                      border: '2px solid #f59e0b',
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                            {metric.metricType.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            {new Date(metric.timestamp).toLocaleString()}
                            {metric.componentName && ` • ${metric.componentName}`}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: '#ef4444' }}>
                            {metric.value}ms
                          </div>
                          <div style={{ fontSize: '11px', color: '#6b7280' }}>
                            Threshold: {metric.threshold}ms
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Anomalies Tab */}
          {activeTab === 'anomalies' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dashboard.dataAnomalies.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✨</div>
                    <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>No anomalies detected</p>
                  </div>
                ) : (
                  dashboard.dataAnomalies.map(anomaly => (
                    <div key={anomaly.id} style={{
                      background: 'white',
                      border: `2px solid ${getSeverityColor(anomaly.severity)}`,
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                            {anomaly.anomalyType.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                            {anomaly.description}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                            Affected: {anomaly.affectedData} • {new Date(anomaly.timestamp).toLocaleString()}
                          </div>
                          {anomaly.recommendations && (
                            <div style={{ marginTop: '12px' }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px' }}>
                                💡 Recommendations:
                              </div>
                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#6b7280' }}>
                                {anomaly.recommendations.map((rec, idx) => (
                                  <li key={idx}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleResolveAnomaly(anomaly.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: '500'
                          }}
                        >
                          Resolve
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Consistency Tab */}
          {activeTab === 'consistency' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {dashboard.consistencyChecks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
                    <p style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>All data is consistent</p>
                  </div>
                ) : (
                  dashboard.consistencyChecks.map(check => (
                    <div key={check.id} style={{
                      background: 'white',
                      border: `2px solid ${getSeverityColor(check.severity)}`,
                      borderRadius: '12px',
                      padding: '16px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                            {check.checkType.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                            {check.description}
                          </div>
                          <div style={{ fontSize: '12px', color: '#6b7280' }}>
                            Affected records: {check.affectedRecords} • {new Date(check.timestamp).toLocaleString()}
                          </div>
                          {check.fixAction && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              background: check.autoFixable ? '#dcfce7' : '#fef3c7',
                              borderRadius: '6px',
                              fontSize: '12px'
                            }}>
                              {check.autoFixable ? '🔧 Auto-fixable: ' : '⚠️ Manual fix required: '}
                              {check.fixAction}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemMonitoring;
