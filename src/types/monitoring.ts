// Monitoring and Error Detection Types

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ErrorCategory = 
  | 'javascript_error'
  | 'api_failure'
  | 'data_inconsistency'
  | 'performance_issue'
  | 'security_violation'
  | 'ui_rendering'
  | 'network_error'
  | 'database_error'
  | 'validation_error'
  | 'authentication_error';

export type AnomalyType = 
  | 'unusual_activity'
  | 'data_corruption'
  | 'memory_leak'
  | 'slow_response'
  | 'high_error_rate'
  | 'suspicious_pattern'
  | 'resource_exhaustion';

export interface ErrorLog {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  componentName?: string;
  userId?: string;
  userEmail?: string;
  url?: string;
  userAgent?: string;
  additionalData?: Record<string, any>;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  notes?: string;
}

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  metricType: 'page_load' | 'api_call' | 'render_time' | 'memory_usage' | 'bundle_size';
  value: number;
  threshold: number;
  exceedsThreshold: boolean;
  url?: string;
  componentName?: string;
  additionalData?: Record<string, any>;
}

export interface DataAnomalyDetection {
  id: string;
  timestamp: string;
  anomalyType: AnomalyType;
  description: string;
  affectedData: string;
  severity: ErrorSeverity;
  detectedBy: 'auto' | 'manual';
  recommendations?: string[];
  resolved?: boolean;
}

export interface SystemHealthMetrics {
  timestamp: string;
  totalErrors: number;
  criticalErrors: number;
  averageResponseTime: number;
  memoryUsage: number;
  activeUsers: number;
  failedApiCalls: number;
  successRate: number;
  uptime: number;
}

export interface ValidationIssue {
  id: string;
  timestamp: string;
  field: string;
  expectedFormat: string;
  actualValue: any;
  validationRule: string;
  severity: ErrorSeverity;
  userId?: string;
  formName?: string;
}

export interface ConsistencyCheck {
  id: string;
  timestamp: string;
  checkType: 'duplicate_records' | 'missing_references' | 'invalid_relationships' | 'orphaned_data' | 'data_mismatch';
  description: string;
  affectedRecords: number;
  severity: ErrorSeverity;
  autoFixable: boolean;
  fixAction?: string;
}

export interface MonitoringDashboard {
  systemHealth: SystemHealthMetrics;
  recentErrors: ErrorLog[];
  performanceMetrics: PerformanceMetric[];
  dataAnomalies: DataAnomalyDetection[];
  validationIssues: ValidationIssue[];
  consistencyChecks: ConsistencyCheck[];
}
