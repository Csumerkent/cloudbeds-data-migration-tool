// --- Debug Logger ---
// Session-based in-memory log. Resets on app close.

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  payload?: unknown;
}

const logs: LogEntry[] = [];

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

export function log(level: LogLevel, module: string, message: string, payload?: unknown): void {
  const entry: LogEntry = { timestamp: now(), level, module, message, payload };
  logs.push(entry);
}

export function info(module: string, message: string, payload?: unknown): void {
  log('INFO', module, message, payload);
}

export function warn(module: string, message: string, payload?: unknown): void {
  log('WARN', module, message, payload);
}

export function error(module: string, message: string, payload?: unknown): void {
  log('ERROR', module, message, payload);
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs.length = 0;
}
