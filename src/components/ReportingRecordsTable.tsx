interface ReportingRecord {
  reservationNumber: string;
  profileNumber: string;
  email: string;
  failureReason?: string;
}

interface ReportingRecordsTableProps {
  title: string;
  tone: 'success' | 'failure';
  records: ReportingRecord[];
}

function ReportingRecordsTable({ title, tone, records }: ReportingRecordsTableProps) {
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
        <table className="enterprise-table">
          <thead>
            <tr>
              <th>Reservation Number</th>
              <th>Profile Number</th>
              <th>Email Address</th>
              {tone === 'failure' ? <th>Failure Reason</th> : null}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={`${record.reservationNumber}-${record.profileNumber}`}>
                <td>{record.reservationNumber}</td>
                <td>{record.profileNumber}</td>
                <td>{record.email}</td>
                {tone === 'failure' ? <td>{record.failureReason ?? 'Pending investigation'}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { ReportingRecord };
export default ReportingRecordsTable;
