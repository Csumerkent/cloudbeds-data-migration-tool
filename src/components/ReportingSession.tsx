import { useState } from 'react';
import PageShell from './PageShell';
import ReportingRecordsTable, { type ReportingRecord } from './ReportingRecordsTable';

interface SessionData {
  id: string;
  label: string;
  runDate: string;
  operator: string;
  successRate: string;
  successfulRecords: ReportingRecord[];
  failedRecords: ReportingRecord[];
}

const SESSIONS: SessionData[] = [
  {
    id: 'session-1',
    label: 'Session 1',
    runDate: '15 Apr 2026, 09:40',
    operator: 'Onboarding Team A',
    successRate: '91%',
    successfulRecords: [
      { reservationNumber: 'CBR-10421', profileNumber: 'PF-20031', email: 'ayse.demir@example.com' },
      { reservationNumber: 'CBR-10422', profileNumber: 'PF-20032', email: 'murat.kaya@example.com' },
      { reservationNumber: 'CBR-10427', profileNumber: 'PF-20039', email: 'elif.sahin@example.com' },
    ],
    failedRecords: [
      {
        reservationNumber: 'CBR-10425',
        profileNumber: 'PF-20035',
        email: 'ops+missing-rate@example.com',
        failureReason: 'Rate plan could not be resolved for room type DLX-SEA.',
      },
      {
        reservationNumber: 'CBR-10429',
        profileNumber: 'PF-20041',
        email: 'ops+source-mismatch@example.com',
        failureReason: 'Source ID missing for former PMS source configuration.',
      },
    ],
  },
  {
    id: 'session-2',
    label: 'Session 2',
    runDate: '15 Apr 2026, 13:10',
    operator: 'Onboarding Team B',
    successRate: '96%',
    successfulRecords: [
      { reservationNumber: 'CBR-10501', profileNumber: 'PF-20110', email: 'fatma.arslan@example.com' },
      { reservationNumber: 'CBR-10503', profileNumber: 'PF-20112', email: 'baris.yilmaz@example.com' },
      { reservationNumber: 'CBR-10508', profileNumber: 'PF-20117', email: 'melis.turan@example.com' },
      { reservationNumber: 'CBR-10511', profileNumber: 'PF-20120', email: 'okan.cetin@example.com' },
    ],
    failedRecords: [
      {
        reservationNumber: 'CBR-10506',
        profileNumber: 'PF-20115',
        email: 'ops+duplicate@example.com',
        failureReason: 'Duplicate guest profile detected during migration validation.',
      },
    ],
  },
  {
    id: 'session-3',
    label: 'Session 3',
    runDate: '15 Apr 2026, 17:25',
    operator: 'Evening Support',
    successRate: '88%',
    successfulRecords: [
      { reservationNumber: 'CBR-10600', profileNumber: 'PF-20204', email: 'selin.ozkan@example.com' },
      { reservationNumber: 'CBR-10601', profileNumber: 'PF-20205', email: 'can.akar@example.com' },
    ],
    failedRecords: [
      {
        reservationNumber: 'CBR-10603',
        profileNumber: 'PF-20207',
        email: 'ops+missing-room@example.com',
        failureReason: 'Mapped room number was not found in Cloudbeds room inventory.',
      },
      {
        reservationNumber: 'CBR-10604',
        profileNumber: 'PF-20208',
        email: 'ops+invalid-email@example.com',
        failureReason: 'Profile email failed normalization and API payload validation.',
      },
      {
        reservationNumber: 'CBR-10607',
        profileNumber: 'PF-20211',
        email: 'ops+cutoff@example.com',
        failureReason: 'Session stopped before accounting follow-up rows were processed.',
      },
    ],
  },
];

function ReportingSession() {
  const [activeSessionId, setActiveSessionId] = useState(SESSIONS[0].id);
  const activeSession = SESSIONS.find((session) => session.id === activeSessionId) ?? SESSIONS[0];

  return (
    <PageShell
      eyebrow="Reporting"
      title="Migration Session Reporting"
      description="Review successful and failed migrated records by session so post-migration follow-up stays structured, auditable, and easy to scan."
      badge="Post-Migration Results"
      meta={[
        { label: 'Selected session', value: activeSession.label },
        { label: 'Run date', value: activeSession.runDate },
        { label: 'Operator', value: activeSession.operator },
        { label: 'Success rate', value: activeSession.successRate },
      ]}
      actions={
        <div className="session-switcher">
          {SESSIONS.map((session) => (
            <button
              key={session.id}
              type="button"
              className={`session-switcher__button${session.id === activeSessionId ? ' session-switcher__button--active' : ''}`}
              onClick={() => setActiveSessionId(session.id)}
            >
              {session.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="report-summary">
        <div className="report-summary__card">
          <span>Successful records</span>
          <strong>{activeSession.successfulRecords.length}</strong>
        </div>
        <div className="report-summary__card report-summary__card--warning">
          <span>Failed records</span>
          <strong>{activeSession.failedRecords.length}</strong>
        </div>
      </div>

      <div className="report-stack">
        <ReportingRecordsTable
          title="Successful Records"
          tone="success"
          records={activeSession.successfulRecords}
        />
        <ReportingRecordsTable
          title="Failed Records"
          tone="failure"
          records={activeSession.failedRecords}
        />
      </div>
    </PageShell>
  );
}

export default ReportingSession;
