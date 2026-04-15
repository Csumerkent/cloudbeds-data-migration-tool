// --- Debug Logger ---
// Session-based in-memory log. Resets on app close.
import { formatAppDateTimeForLog, getCurrentAppDateTime } from './appDateTimeService';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogMeta {
  moduleScope?: string;
  fileName?: string;
  jobId?: string;
  chunkId?: string;
  rowNumber?: number;
  logKind?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  step: string;
  message: string;
  payload?: unknown;
  meta?: LogMeta;
}

const logs: LogEntry[] = [];

function now(): string {
  return formatAppDateTimeForLog(getCurrentAppDateTime());
}

export function log(
  level: LogLevel,
  module: string,
  step: string,
  message: string,
  payload?: unknown,
  meta?: LogMeta,
): void {
  logs.push({ timestamp: now(), level, module, step, message, payload, meta });
}

export function debug(module: string, step: string, message: string, payload?: unknown, meta?: LogMeta): void {
  log('DEBUG', module, step, message, payload, meta);
}

export function info(module: string, step: string, message: string, payload?: unknown, meta?: LogMeta): void {
  log('INFO', module, step, message, payload, meta);
}

export function warn(module: string, step: string, message: string, payload?: unknown, meta?: LogMeta): void {
  log('WARN', module, step, message, payload, meta);
}

export function error(module: string, step: string, message: string, payload?: unknown, meta?: LogMeta): void {
  log('ERROR', module, step, message, payload, meta);
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

export function getLogsByModule(module: string): LogEntry[] {
  return logs.filter((l) => l.module === module);
}
