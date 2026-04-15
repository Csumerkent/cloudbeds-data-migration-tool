import { Fragment, useState } from 'react';

interface ReportingRecord {
  rowNumber: number;
  reservationId?: string;
  guestId?: string;
  email: string;
  failureReason?: string;
  payload?: Record<string, string>;
  apiResponse?: unknown;
  apiHttpStatus?: number;
}

interface ReportingRecordsTableProps {
  title: string;
  tone: 'success' | 'failure';
  records: ReportingRecord[];
}

function ReportingRecordsTable({ title, tone, records }: ReportingRecordsTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (rowNumber: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  return (
    <section className={`report-table report-table--${tone}`}>
      <div className="report-table__header">
        <div>
          <h3>{title}</h3>
          <p>
            {tone === 'success'
              ? 'Completed migrations ready for post-run spot checks.'
              : 'Records that need follow-up before the next migration session.'}
          </p>
        </div>
        <span className="report-table__count">{records.length} records</span>
      </div>

      <div className="report-table__body">
        {records.length === 0 ? (
          <div className="status-area status-area--idle">
            {tone === 'success'
              ? 'No successful records yet for this session.'
              : 'No failed records for this session.'}
          </div>
        ) : (
          <table className="enterprise-table">
            <thead>
              <tr>
                {tone === 'failure' ? <th style={{ width: 40 }}></th> : null}
                <th style={{ width: 100 }}>Row Number</th>
                {tone === 'success' ? <th>Reservation ID</th> : null}
                {tone === 'success' ? <th>Guest ID</th> : null}
                <th>Email Address</th>
                {tone === 'failure' ? <th>Failure Reason</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isOpen = expanded.has(record.rowNumber);
                return (
                  <Fragment key={`rec-${record.rowNumber}`}>
                    <tr
                      onClick={tone === 'failure' ? () => toggle(record.rowNumber) : undefined}
                      style={{ cursor: tone === 'failure' ? 'pointer' : 'default' }}
                    >
                      {tone === 'failure' ? (
                        <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                          {isOpen ? '-' : '+'}
                        </td>
                      ) : null}
                      <td>{record.rowNumber}</td>
                      {tone === 'success' ? <td>{record.reservationId ?? '—'}</td> : null}
                      {tone === 'success' ? <td>{record.guestId ?? '—'}</td> : null}
                      <td>{record.email}</td>
                      {tone === 'failure' ? (
                        <td>{record.failureReason ?? 'Pending investigation'}</td>
                      ) : null}
                    </tr>
                    {tone === 'failure' && isOpen ? (
                      <tr>
                        <td colSpan={4} style={{ background: 'rgba(0,0,0,0.03)' }}>
                          <div style={{ padding: '0.75rem 1rem', display: 'grid', gap: '0.75rem' }}>
                            <div>
                              <strong>Request payload</strong>
                              <pre className="debug-payload" style={{ maxHeight: 240, overflow: 'auto' }}>
                                {record.payload
                                  ? JSON.stringify(record.payload, null, 2)
                                  : 'No payload captured.'}
                              </pre>
                            </div>
                            <div>
                              <strong>API response{record.apiHttpStatus ? ` (HTTP ${record.apiHttpStatus})` : ''}</strong>
                              <pre className="debug-payload" style={{ maxHeight: 240, overflow: 'auto' }}>
                                {record.apiResponse !== undefined && record.apiResponse !== null
                                  ? JSON.stringify(record.apiResponse, null, 2)
                                  : 'No API response captured (validation failure).'}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export type { ReportingRecord };
export default ReportingRecordsTable;
