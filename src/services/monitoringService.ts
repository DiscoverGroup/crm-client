import type { 
  ErrorLog, 
  PerformanceMetric, 
  DataAnomalyDetection, 
  SystemHealthMetrics,
  ValidationIssue,
  ConsistencyCheck,
  MonitoringDashboard
} from '../types/monitoring';

class MonitoringService {
  private errorLogs: ErrorLog[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private anomalies: DataAnomalyDetection[] = [];
  private validationIssues: ValidationIssue[] = [];
  private consistencyChecks: ConsistencyCheck[] = [];
  private readonly STORAGE_KEY = 'crm_monitoring_data';
  private readonly MAX_LOGS = 1000;

  constructor() {
    this.loadFromStorage();
    this.initializeErrorCapture();
    this.initializePerformanceMonitoring();
    this.startAutomaticChecks();
  }

  // Initialize global error capturing
  private initializeErrorCapture() {
    if (typeof window === 'undefined') return;

    // Capture unhandled errors
    window.addEventListener('error', (event) => {
      this.logError({
        severity: 'high',
        category: 'javascript_error',
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        additionalData: {
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        severity: 'high',
        category: 'javascript_error',
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        additionalData: {
          reason: event.reason
        }
      });
    });

    // Intercept console.error
    const originalError = console.error;
    console.error = (...args: any[]) => {
      this.logError({
        severity: 'medium',
        category: 'javascript_error',
        message: args.join(' ')
      });
      originalError.apply(console, args);
    };
  }

  // Initialize performance monitoring
  private initializePerformanceMonitoring() {
    if (typeof window === 'undefined') return;

    // Monitor page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const perfData = performance.getEntriesByType('navigation')[0] as any;
        if (perfData) {
          this.logPerformanceMetric({
            metricType: 'page_load',
            value: perfData.loadEventEnd - perfData.loadEventStart,
            threshold: 3000, // 3 seconds
            url: window.location.href
          });
        }
      }, 0);
    });

    // Monitor memory usage (if available)
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.logPerformanceMetric({
          metricType: 'memory_usage',
          value: memory.usedJSHeapSize / 1048576, // Convert to MB
          threshold: 100 // 100MB
        });
      }, 60000); // Check every minute
    }
  }

  // Start automatic checks
  private startAutomaticChecks() {
    // Run data consistency checks every 5 minutes
    setInterval(() => {
      this.runDataConsistencyChecks();
    }, 300000);

    // Run anomaly detection every 2 minutes
    setInterval(() => {
      this.detectAnomalies();
    }, 120000);
  }

  // Log error
  logError(error: Partial<ErrorLog>) {
    const errorLog: ErrorLog = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      severity: error.severity || 'medium',
      category: error.category || 'javascript_error',
      message: error.message || 'Unknown error',
      stack: error.stack,
      componentName: error.componentName,
      userId: error.userId,
      userEmail: error.userEmail,
      url: error.url || window.location.href,
      userAgent: navigator.userAgent,
      additionalData: error.additionalData,
      resolved: false
    };

    this.errorLogs.unshift(errorLog);
    this.trimLogs();
    this.saveToStorage();

    // Check if error rate is too high
    this.checkErrorRate();

    return errorLog;
  }

  // Log performance metric
  logPerformanceMetric(metric: Partial<PerformanceMetric>) {
    const perfMetric: PerformanceMetric = {
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      metricType: metric.metricType || 'page_load',
      value: metric.value || 0,
      threshold: metric.threshold || 1000,
      exceedsThreshold: (metric.value || 0) > (metric.threshold || 1000),
      url: metric.url,
      componentName: metric.componentName,
      additionalData: metric.additionalData
    };

    this.performanceMetrics.unshift(perfMetric);
    this.trimLogs();
    this.saveToStorage();

    // Log as error if threshold exceeded
    if (perfMetric.exceedsThreshold) {
      this.logError({
        severity: 'medium',
        category: 'performance_issue',
        message: `Performance threshold exceeded: ${metric.metricType} took ${metric.value}ms (threshold: ${metric.threshold}ms)`,
        componentName: metric.componentName,
        additionalData: { metric: perfMetric }
      });
    }

    return perfMetric;
  }

  // Log validation issue
  logValidationIssue(issue: Partial<ValidationIssue>) {
    const validationIssue: ValidationIssue = {
      id: `validation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      field: issue.field || 'unknown',
      expectedFormat: issue.expectedFormat || '',
      actualValue: issue.actualValue,
      validationRule: issue.validationRule || '',
      severity: issue.severity || 'low',
      userId: issue.userId,
      formName: issue.formName
    };

    this.validationIssues.unshift(validationIssue);
    this.trimLogs();
    this.saveToStorage();

    return validationIssue;
  }

  // Detect anomalies
  private detectAnomalies() {
    // Check for high error rate
    const recentErrors = this.getErrorsInTimeRange(300000); // Last 5 minutes
    if (recentErrors.length > 10) {
      this.logAnomaly({
        anomalyType: 'high_error_rate',
        description: `High error rate detected: ${recentErrors.length} errors in the last 5 minutes`,
        affectedData: 'System-wide',
        severity: 'high',
        recommendations: [
          'Check server status',
          'Review recent deployments',
          'Check third-party service status'
        ]
      });
    }

    // Check for memory leaks
    const memoryMetrics = this.performanceMetrics
      .filter(m => m.metricType === 'memory_usage')
      .slice(0, 10);
    
    if (memoryMetrics.length >= 5) {
      const trend = this.calculateTrend(memoryMetrics.map(m => m.value));
      if (trend > 10) { // Memory increasing by 10MB+
        this.logAnomaly({
          anomalyType: 'memory_leak',
          description: 'Potential memory leak detected: Memory usage increasing consistently',
          affectedData: 'Application memory',
          severity: 'medium',
          recommendations: [
            'Check for unclosed connections',
            'Review recent code changes',
            'Monitor component lifecycle'
          ]
        });
      }
    }

    // Check for slow API responses
    const slowAPIs = this.performanceMetrics
      .filter(m => m.metricType === 'api_call' && m.exceedsThreshold)
      .slice(0, 20);
    
    if (slowAPIs.length > 5) {
      this.logAnomaly({
        anomalyType: 'slow_response',
        description: `${slowAPIs.length} slow API calls detected recently`,
        affectedData: 'API endpoints',
        severity: 'medium',
        recommendations: [
          'Check database query performance',
          'Review API endpoint optimization',
          'Check network connectivity'
        ]
      });
    }
  }

  // Run data consistency checks
  private runDataConsistencyChecks() {
    try {
      // Check for duplicate records in localStorage
      const clients = JSON.parse(localStorage.getItem('clients') || '[]');
      const duplicates = this.findDuplicates(clients, 'email');
      
      if (duplicates.length > 0) {
        this.logConsistencyCheck({
          checkType: 'duplicate_records',
          description: `Found ${duplicates.length} duplicate client records`,
          affectedRecords: duplicates.length,
          severity: 'medium',
          autoFixable: true,
          fixAction: 'Merge duplicate records'
        });
      }

      // Check for orphaned data
      const messages = JSON.parse(localStorage.getItem('messages') || '[]');
      const orphanedMessages = messages.filter((msg: any) => {
        return !clients.some((client: any) => client.id === msg.clientId);
      });

      if (orphanedMessages.length > 0) {
        this.logConsistencyCheck({
          checkType: 'orphaned_data',
          description: `Found ${orphanedMessages.length} messages without associated clients`,
          affectedRecords: orphanedMessages.length,
          severity: 'low',
          autoFixable: true,
          fixAction: 'Clean up orphaned messages'
        });
      }

      // Check for missing required fields
      const invalidClients = clients.filter((client: any) => {
        return !client.name || !client.email || !client.status;
      });

      if (invalidClients.length > 0) {
        this.logConsistencyCheck({
          checkType: 'data_mismatch',
          description: `Found ${invalidClients.length} clients with missing required fields`,
          affectedRecords: invalidClients.length,
          severity: 'high',
          autoFixable: false,
          fixAction: 'Manually review and update records'
        });
      }
    } catch (error) {
      console.error('Error running consistency checks:', error);
    }
  }

  // Log anomaly
  private logAnomaly(anomaly: Partial<DataAnomalyDetection>) {
    const existing = this.anomalies.find(
      a => a.anomalyType === anomaly.anomalyType && !a.resolved
    );

    // Don't log duplicate unresolved anomalies
    if (existing) return;

    const dataAnomaly: DataAnomalyDetection = {
      id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      anomalyType: anomaly.anomalyType || 'unusual_activity',
      description: anomaly.description || '',
      affectedData: anomaly.affectedData || '',
      severity: anomaly.severity || 'medium',
      detectedBy: 'auto',
      recommendations: anomaly.recommendations,
      resolved: false
    };

    this.anomalies.unshift(dataAnomaly);
    this.trimLogs();
    this.saveToStorage();

    return dataAnomaly;
  }

  // Log consistency check
  private logConsistencyCheck(check: Partial<ConsistencyCheck>) {
    const consistencyCheck: ConsistencyCheck = {
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      checkType: check.checkType || 'data_mismatch',
      description: check.description || '',
      affectedRecords: check.affectedRecords || 0,
      severity: check.severity || 'low',
      autoFixable: check.autoFixable || false,
      fixAction: check.fixAction
    };

    this.consistencyChecks.unshift(consistencyCheck);
    this.trimLogs();
    this.saveToStorage();

    return consistencyCheck;
  }

  // Get dashboard data
  getDashboard(): MonitoringDashboard {
    return {
      systemHealth: this.getSystemHealth(),
      recentErrors: this.errorLogs.slice(0, 50),
      performanceMetrics: this.performanceMetrics.slice(0, 50),
      dataAnomalies: this.anomalies.filter(a => !a.resolved).slice(0, 20),
      validationIssues: this.validationIssues.slice(0, 30),
      consistencyChecks: this.consistencyChecks.slice(0, 20)
    };
  }

  // Get system health metrics
  private getSystemHealth(): SystemHealthMetrics {
    const last24Hours = 24 * 60 * 60 * 1000;
    const recentErrors = this.getErrorsInTimeRange(last24Hours);
    const criticalErrors = recentErrors.filter(e => e.severity === 'critical').length;
    
    const recentPerf = this.performanceMetrics
      .filter(m => Date.now() - new Date(m.timestamp).getTime() < last24Hours);
    
    const avgResponseTime = recentPerf.length > 0
      ? recentPerf.reduce((sum, m) => sum + m.value, 0) / recentPerf.length
      : 0;

    const failedApiCalls = recentErrors.filter(e => e.category === 'api_failure').length;
    const totalApiCalls = recentPerf.filter(m => m.metricType === 'api_call').length;
    const successRate = totalApiCalls > 0 
      ? ((totalApiCalls - failedApiCalls) / totalApiCalls) * 100
      : 100;

    return {
      timestamp: new Date().toISOString(),
      totalErrors: recentErrors.length,
      criticalErrors,
      averageResponseTime: Math.round(avgResponseTime),
      memoryUsage: this.getCurrentMemoryUsage(),
      activeUsers: this.getActiveUserCount(),
      failedApiCalls,
      successRate: Math.round(successRate * 100) / 100,
      uptime: this.calculateUptime()
    };
  }

  // Helper methods
  private getErrorsInTimeRange(milliseconds: number): ErrorLog[] {
    const cutoff = Date.now() - milliseconds;
    return this.errorLogs.filter(
      log => new Date(log.timestamp).getTime() > cutoff
    );
  }

  private checkErrorRate() {
    const recentErrors = this.getErrorsInTimeRange(60000); // Last minute
    if (recentErrors.length > 5) {
      console.warn(`⚠️ High error rate: ${recentErrors.length} errors in the last minute`);
    }
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const first = values[values.length - 1];
    const last = values[0];
    return last - first;
  }

  private findDuplicates(array: any[], key: string): any[] {
    const seen = new Set();
    const duplicates: any[] = [];
    
    array.forEach(item => {
      if (seen.has(item[key])) {
        duplicates.push(item);
      } else {
        seen.add(item[key]);
      }
    });
    
    return duplicates;
  }

  private getCurrentMemoryUsage(): number {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1048576);
    }
    return 0;
  }

  private getActiveUserCount(): number {
    // Implement based on your user tracking
    const userData = localStorage.getItem('userData');
    return userData ? 1 : 0;
  }

  private calculateUptime(): number {
    const startTime = localStorage.getItem('crm_start_time');
    if (!startTime) {
      localStorage.setItem('crm_start_time', Date.now().toString());
      return 0;
    }
    return Math.round((Date.now() - parseInt(startTime)) / 1000 / 60); // Minutes
  }

  private trimLogs() {
    if (this.errorLogs.length > this.MAX_LOGS) {
      this.errorLogs = this.errorLogs.slice(0, this.MAX_LOGS);
    }
    if (this.performanceMetrics.length > this.MAX_LOGS) {
      this.performanceMetrics = this.performanceMetrics.slice(0, this.MAX_LOGS);
    }
    if (this.anomalies.length > 100) {
      this.anomalies = this.anomalies.slice(0, 100);
    }
    if (this.validationIssues.length > 500) {
      this.validationIssues = this.validationIssues.slice(0, 500);
    }
    if (this.consistencyChecks.length > 100) {
      this.consistencyChecks = this.consistencyChecks.slice(0, 100);
    }
  }

  private saveToStorage() {
    try {
      const data = {
        errorLogs: this.errorLogs,
        performanceMetrics: this.performanceMetrics,
        anomalies: this.anomalies,
        validationIssues: this.validationIssues,
        consistencyChecks: this.consistencyChecks
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save monitoring data:', error);
    }
  }

  private loadFromStorage() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.errorLogs = parsed.errorLogs || [];
        this.performanceMetrics = parsed.performanceMetrics || [];
        this.anomalies = parsed.anomalies || [];
        this.validationIssues = parsed.validationIssues || [];
        this.consistencyChecks = parsed.consistencyChecks || [];
      }
    } catch (error) {
      console.error('Failed to load monitoring data:', error);
    }
  }

  // Public methods
  resolveError(errorId: string, notes?: string) {
    const error = this.errorLogs.find(e => e.id === errorId);
    if (error) {
      error.resolved = true;
      error.resolvedAt = new Date().toISOString();
      error.notes = notes;
      this.saveToStorage();
    }
  }

  resolveAnomaly(anomalyId: string) {
    const anomaly = this.anomalies.find(a => a.id === anomalyId);
    if (anomaly) {
      anomaly.resolved = true;
      this.saveToStorage();
    }
  }

  clearAllLogs() {
    this.errorLogs = [];
    this.performanceMetrics = [];
    this.anomalies = [];
    this.validationIssues = [];
    this.consistencyChecks = [];
    this.saveToStorage();
  }

  exportLogs(): string {
    return JSON.stringify({
      errorLogs: this.errorLogs,
      performanceMetrics: this.performanceMetrics,
      anomalies: this.anomalies,
      validationIssues: this.validationIssues,
      consistencyChecks: this.consistencyChecks,
      exportedAt: new Date().toISOString()
    }, null, 2);
  }
}

// Singleton instance
const monitoringService = new MonitoringService();
export default monitoringService;
