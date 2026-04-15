// ---------------------------------------------------------------------------
// Migration session store
// ---------------------------------------------------------------------------
// In-memory singleton that captures the most recent reservation migration run
// so the Reporting page can show real outcomes instead of placeholder data.
// Memory-only by design: session history resets when the app is reloaded.
// ---------------------------------------------------------------------------

import type { MigrationProgress, MigrationRow } from './reservationMigrationService';

export interface MigrationSessionRecord {
  id: string;
  moduleName: string;
  fileName: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  succeeded: number;
  failed: number;
  stopped: boolean;
  successRate: string;
  rows: MigrationRow[];
}

type Listener = () => void;

let currentSession: MigrationSessionRecord | null = null;
const listeners = new Set<Listener>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* swallow */
    }
  }
}

export function getCurrentSession(): MigrationSessionRecord | null {
  return currentSession;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordMigrationSession(params: {
  moduleName: string;
  fileName: string;
  startedAt: Date;
  finishedAt: Date;
  progress: MigrationProgress;
}): MigrationSessionRecord {
  const rate =
    params.progress.total > 0
      ? `${Math.round((params.progress.succeeded / params.progress.total) * 100)}%`
      : '—';
  const session: MigrationSessionRecord = {
    id: `session-${params.startedAt.getTime()}`,
    moduleName: params.moduleName,
    fileName: params.fileName,
    startedAt: params.startedAt.toISOString(),
    finishedAt: params.finishedAt.toISOString(),
    total: params.progress.total,
    succeeded: params.progress.succeeded,
    failed: params.progress.failed,
    stopped: !!params.progress.stopped,
    successRate: rate,
    rows: params.progress.rows.map((row) => ({ ...row })),
  };
  currentSession = session;
  notify();
  return session;
}
