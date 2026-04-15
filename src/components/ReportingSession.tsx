import { useEffect, useState } from 'react';
import PageShell from './PageShell';
import ReportingRecordsTable, { type ReportingRecord } from './ReportingRecordsTable';
import {
  getCurrentSession,
  subscribe,
  type MigrationSessionRecord,
} from '../services/migrationSessionStore';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function toRecords(session: MigrationSessionRecord): {
  successful: ReportingRecord[];
  failed: ReportingRecord[];
} {
  const successful: ReportingRecord[] = [];
  const failed: ReportingRecord[] = [];
  for (const row of session.rows) {
    const email = row.guestEmail || row.finalEmail || row.normalizedEmail || '—';
    if (row.status === 'success') {
      successful.push({
        rowNumber: row.rowNumber,
        reservationId: row.reservationId,
        guestId: row.guestId,
        email,
      });
    } else if (row.status === 'failed' || row.status === 'skipped') {
      failed.push({
        rowNumber: row.rowNumber,
        email,
        failureReason: row.message,
        payload: row.payload,
        apiResponse: row.apiResponse,
        apiHttpStatus: row.apiHttpStatus,
      });
    }
  }
  return { successful, failed };
}

function ReportingSession() {
  const [session, setSession] = useState<MigrationSessionRecord | null>(() => getCurrentSession());

  useEffect(() => {
    const unsubscribe = subscribe(() => {
      setSession(getCurrentSession());
    });
    return unsubscribe;
  }, []);

  if (!session) {
    return (
      <PageShell
        eyebrow="Reporting"
        title="Migration Session Reporting"
        description="Review successful and failed migrated records by session so post-migration follow-up stays structured, auditable, and easy to scan."
        badge="Post-Migration Results"
        meta={[{ label: 'Current session', value: 'No run yet' }]}
      >
        <div className="status-area status-area--idle">
          No migration has been executed yet. Start a reservation migration to populate this session.
        </div>
      </PageShell>
    );
  }

  const { successful, failed } = toRecords(session);
  const runLabel = session.stopped ? 'Stopped' : 'Completed';

  return (
    <PageShell
      eyebrow="Reporting"
      title="Migration Session Reporting"
      description="Review successful and failed migrated records from the most recent migration run."
      badge="Post-Migration Results"
      meta={[
        { label: 'Module', value: session.moduleName },
        { label: 'File', value: session.fileName },
        { label: 'Run started', value: formatTimestamp(session.startedAt) },
        { label: 'Run finished', value: `${formatTimestamp(session.finishedAt)} (${runLabel})` },
        { label: 'Success rate', value: `${session.successRate} (${session.succeeded}/${session.total})` },
      ]}
    >
      <div className="report-summary">
        <div className="report-summary__card">
          <span>Successful records</span>
          <strong>{successful.length}</strong>
        </div>
        <div className="report-summary__card report-summary__card--warning">
          <span>Failed records</span>
          <strong>{failed.length}</strong>
        </div>
      </div>

      <div className="report-stack">
        <ReportingRecordsTable title="Successful Records" tone="success" records={successful} />
        <ReportingRecordsTable title="Failed Records" tone="failure" records={failed} />
      </div>
    </PageShell>
  );
}

export default ReportingSession;
