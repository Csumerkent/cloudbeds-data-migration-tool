import { useMemo, useState } from 'react';
import PageShell from './PageShell';
import ReportingRecordsTable, {
  type FailedReportingRecord,
  type SuccessfulReportingRecord,
} from './ReportingRecordsTable';
import { getMigrationSessions } from '../services/migrationSessionService';
import type { NavigationFilters } from '../types/navigation';

interface ReportingSessionProps {
  navigationFilters: NavigationFilters;
}

function formatSessionLabel(fileName: string, completedAt: string | null): string {
  const suffix = completedAt
    ? new Date(completedAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    : 'Current session';
  return `${fileName} - ${suffix}`;
}

function ReportingSession({ navigationFilters }: ReportingSessionProps) {
  const sessions = useMemo(
    () => getMigrationSessions('Reservation'),
    [],
  );

  const initialSessionId = navigationFilters.jobId && sessions.some((session) => session.id === navigationFilters.jobId)
    ? navigationFilters.jobId
    : sessions[0]?.id;
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(initialSessionId);

  const activeSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];

  const successfulRecords: SuccessfulReportingRecord[] = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.rows
      .filter((row) => row.status === 'success')
      .map((row) => ({
        rowNumber: row.rowNumber,
        reservationId: row.reservationId,
        guestId: row.guestId,
        email: row.guestEmail ?? row.finalEmail ?? '',
      }));
  }, [activeSession]);

  const failedRecords: FailedReportingRecord[] = useMemo(() => {
    if (!activeSession) return [];
    return activeSession.rows
      .filter((row) => row.status === 'failed' || row.status === 'skipped')
      .map((row) => ({
        rowNumber: row.rowNumber,
        email: row.guestEmail ?? row.finalEmail ?? '',
        failureReason: row.message || 'Pending investigation',
        payload: row.payload,
        failureDetails: row.failureDetails,
        responseBody: row.responseBody,
      }));
  }, [activeSession]);

  if (!activeSession) {
    return (
      <PageShell
        eyebrow="Reporting"
        title="Migration Session Reporting"
        description="Review successful and failed migrated records by session so post-migration follow-up stays structured, auditable, and easy to scan."
        badge="Post-Migration Results"
      >
        <div className="status-area status-area--idle">
          No real Reservation migration sessions are available yet.
        </div>
      </PageShell>
    );
  }

  const successRate = activeSession.total > 0
    ? `${Math.round((activeSession.succeeded / activeSession.total) * 100)}%`
    : '0%';

  return (
    <PageShell
      eyebrow="Reporting"
      title="Migration Session Reporting"
      description="Review successful and failed Reservation migration records using the real session data captured during execution."
      badge="Post-Migration Results"
      meta={[
        { label: 'Selected session', value: formatSessionLabel(activeSession.fileName, activeSession.completedAt) },
        { label: 'Run date', value: activeSession.completedAt ? new Date(activeSession.completedAt).toLocaleString('en-GB') : 'Current session' },
        { label: 'File', value: activeSession.fileName },
        { label: 'Success rate', value: successRate },
      ]}
      actions={
        sessions.length > 1 ? (
          <div className="session-switcher">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={`session-switcher__button${session.id === activeSession.id ? ' session-switcher__button--active' : ''}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                {formatSessionLabel(session.fileName, session.completedAt)}
              </button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="report-summary">
        <div className="report-summary__card">
          <span>Successful records</span>
          <strong>{successfulRecords.length}</strong>
        </div>
        <div className="report-summary__card report-summary__card--warning">
          <span>Failed records</span>
          <strong>{failedRecords.length}</strong>
        </div>
      </div>

      <div className="report-stack">
        <ReportingRecordsTable
          title="Successful Records"
          tone="success"
          records={successfulRecords}
        />
        <ReportingRecordsTable
          title="Failed Records"
          tone="failure"
          records={failedRecords}
        />
      </div>
    </PageShell>
  );
}

export default ReportingSession;
