// --- Debug Logger ---
// Session-based in-memory log. Resets on app close.

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  step: string;
  message: string;
  payload?: unknown;
}

const logs: LogEntry[] = [];

function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 23);
}

export function log(level: LogLevel, module: string, step: string, message: string, payload?: unknown): void {
  logs.push({ timestamp: now(), level, module, step, message, payload });
}

export function debug(module: string, step: string, message: string, payload?: unknown): void {
  log('DEBUG', module, step, message, payload);
}

export function info(module: string, step: string, message: string, payload?: unknown): void {
  log('INFO', module, step, message, payload);
}

export function warn(module: string, step: string, message: string, payload?: unknown): void {
  log('WARN', module, step, message, payload);
}

export function error(module: string, step: string, message: string, payload?: unknown): void {
  log('ERROR', module, step, message, payload);
}

export function getLogs(): LogEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs.length = 0;
}

export function getModules(): string[] {
  return [...new Set(logs.map((l) => l.module))];
}
