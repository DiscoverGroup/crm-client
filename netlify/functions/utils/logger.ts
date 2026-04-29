/**
 * Structured logger for Netlify Functions.
 * Outputs JSON lines to stdout — captured by Netlify Function Logs.
 * Each log line is searchable by field in the Netlify dashboard.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  fn: string;        // function name
  msg: string;
  durationMs?: number;
  userId?: string;
  ip?: string;
  op?: string;       // e.g. "find:clients"
  statusCode?: number;
  [key: string]: unknown;
}

function log(entry: LogEntry): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  if (entry.level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(entry: Omit<LogEntry, 'level'>): void {
  log({ level: 'info', ...entry });
}

export function logWarn(entry: Omit<LogEntry, 'level'>): void {
  log({ level: 'warn', ...entry });
}

export function logError(entry: Omit<LogEntry, 'level'>): void {
  log({ level: 'error', ...entry });
}

/** Returns a function that logs duration from now when called. */
export function startTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}
