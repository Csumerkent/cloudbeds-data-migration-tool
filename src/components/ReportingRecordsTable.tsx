import { Fragment, useState } from 'react';

interface BaseReportingRecord {
  rowNumber: number;
  email: string;
}

export interface SuccessfulReportingRecord extends BaseReportingRecord {
  reservationId?: string;
  guestId?: string;
}

export interface FailedReportingRecord extends BaseReportingRecord {
  failureReason: string;
  payload?: Record<string, string>;
  failureDetails?: string[];
  responseBody?: unknown;
}

interface ReportingRecordsTableProps {
  title: string;
  tone: 'success' | 'failure';
  records: SuccessfulReportingRecord[] | FailedReportingRecord[];
}

function ReportingRecordsTable({ title, tone, records }: ReportingRecordsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (rowNumber: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
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
              ? 'Completed migrations bound to real response identifiers.'
              : 'Failed rows include the real payload and returned failure details.'}
          </p>
        </div>
        <span className="report-table__count">{records.length} records</span>
      </div>

      <div className="report-table__body">
        <table className="enterprise-table">
          <thead>
            {tone === 'success' ? (
              <tr>
                <th>Row Number</th>
                <th>Reservation ID</th>
                <th>Guest ID</th>
                <th>Email Address</th>
              </tr>
            ) : (
              <tr>
                <th></th>
                <th>Row Number</th>
                <th>Email Address</th>
                <th>Failure Reason</th>
              </tr>
            )}
          </thead>
          <tbody>
            {tone === 'success'
              ? (records as SuccessfulReportingRecord[]).map((record) => (
                <tr key={`success-${record.rowNumber}`}>
                  <td>{record.rowNumber}</td>
                  <td>{record.reservationId || '-'}</td>
                  <td>{record.guestId || '-'}</td>
                  <td>{record.email || '-'}</td>
                </tr>
              ))
              : (records as FailedReportingRecord[]).map((record) => {
                const isExpanded = expandedRows.has(record.rowNumber);
                return (
                  <Fragment key={`failure-group-${record.rowNumber}`}>
                    <tr key={`failure-${record.rowNumber}`}>
                      <td>
                        <button
                          type="button"
                          className="summary-link-button"
                          onClick={() => toggleRow(record.rowNumber)}
                        >
                          {isExpanded ? 'Hide' : 'Show'}
                        </button>
                      </td>
                      <td>{record.rowNumber}</td>
                      <td>{record.email || '-'}</td>
                      <td>{record.failureReason}</td>
                    </tr>
                    {isExpanded ? (
                      <tr key={`failure-details-${record.rowNumber}`} className="report-table__detail-row">
                        <td colSpan={4}>
                          <div className="report-table__detail-grid">
                            <div>
                              <strong>API Request Payload</strong>
                              <pre className="debug-payload">{JSON.stringify(record.payload ?? {}, null, 2)}</pre>
                            </div>
                            <div>
                              <strong>Error Response / Failure Details</strong>
                              <pre className="debug-payload">
                                {JSON.stringify({
                                  failureDetails: record.failureDetails ?? [],
                                  responseBody: record.responseBody ?? null,
                                }, null, 2)}
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
      </div>
    </section>
  );
}

export default ReportingRecordsTable;
