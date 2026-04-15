import type { MigrationProgress, MigrationRow } from './reservationMigrationService';

const STORAGE_KEY = 'cloudbeds-migration-sessions';
const MAX_SESSIONS = 12;

export interface MigrationSession {
  id: string;
  moduleScope: string;
  fileName: string;
  startedAt: string | null;
  completedAt: string | null;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  stopped: boolean;
  rows: MigrationRow[];
}

function loadRawSessions(): MigrationSession[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as MigrationSession[] : [];
  } catch {
    return [];
  }
}

function saveRawSessions(sessions: MigrationSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getMigrationSessions(moduleScope?: string): MigrationSession[] {
  const sessions = loadRawSessions();
  return moduleScope
    ? sessions.filter((session) => session.moduleScope === moduleScope)
    : sessions;
}

export function saveMigrationSession(
  moduleScope: string,
  fileName: string,
  progress: MigrationProgress,
): MigrationSession {
  const sessions = loadRawSessions().filter((session) => session.id !== progress.jobId);
  const nextSession: MigrationSession = {
    id: progress.jobId,
    moduleScope,
    fileName,
    startedAt: progress.startedAt ?? null,
    completedAt: progress.endedAt ?? null,
    total: progress.total,
    completed: progress.completed,
    succeeded: progress.succeeded,
    failed: progress.failed,
    stopped: !!progress.stopped,
    rows: progress.rows,
  };

  sessions.unshift(nextSession);
  saveRawSessions(sessions.slice(0, MAX_SESSIONS));
  return nextSession;
}
