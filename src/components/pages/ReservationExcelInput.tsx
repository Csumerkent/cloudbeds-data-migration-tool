import { useState } from 'react';
import './pages.css';

interface ValidationSummary {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
}

function ReservationExcelInput() {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [summary, setSummary] = useState<ValidationSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file ? file.name : '');
    setSummary(null);
  };

  const handleValidate = () => {
    // Placeholder: simulate a validation summary locally
    if (!selectedFile) return;
    setSummary({
      fileName: selectedFile,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: ['No real Excel parsing is active yet. This is a placeholder summary.'],
    });
  };

  return (
    <div className="config-page">
      <h3>Reservation Excel Input</h3>

      <div className="config-note">
        Upload a filled reservation Excel file (.xlsx). The application will validate
        the file structure against the expected template before processing.<br /><br />
        <strong>Required columns:</strong> guestName, checkIn, checkOut, roomType,
        roomNumber, source, ratePlan, adults<br />
        <strong>Optional columns:</strong> children, notes, estimatedRevenue,
        paymentMethod
      </div>

      <div className="config-note">
        <strong>Format notes:</strong><br />
        — Dates must be in YYYY-MM-DD format.<br />
        — All required columns must be present even if some rows have empty optional
        values.<br />
        — Only .xlsx files are supported. Maximum file size will be enforced when
        parsing is implemented.
      </div>

      <div className="config-note">
        <strong>Payment note:</strong><br />
        Payment information is informational only during migration. Actual payment
        processing is not performed. The paymentMethod column, if present, is recorded
        for reference but does not trigger any financial transaction.
      </div>

      <div className="config-note" style={{ borderLeftColor: '#e53935', background: '#fff3f3', color: '#b71c1c' }}>
        <strong>Migration limitations:</strong><br />
        — Reservations are created as new records; existing reservations in Cloudbeds
        are not modified.<br />
        — Duplicate detection is based on guest name + check-in + check-out + room.
        Exact deduplication logic will be finalized during validation implementation.<br />
        — Financial records (folios, payments) are not migrated in this phase.<br />
        — Rate resolution depends on matching ratePlanNamePublic to a valid Cloudbeds
        rate plan. Unresolved rates will be flagged during validation.
      </div>

      <div className="config-field">
        <label>Select Excel File</label>
        <input type="file" accept=".xlsx" onChange={handleFileChange} />
      </div>

      <button
        className="btn btn-primary"
        onClick={handleValidate}
        disabled={!selectedFile}
      >
        Validate File
      </button>

      {summary && (
        <div className="config-section" style={{ marginTop: 16 }}>
          <h4>Validation Summary</h4>
          <dl className="summary-grid">
            <dt>File Name</dt>
            <dd>{summary.fileName}</dd>
            <dt>Total Rows</dt>
            <dd>{summary.totalRows}</dd>
            <dt>Valid Rows</dt>
            <dd>{summary.validRows}</dd>
            <dt>Invalid Rows</dt>
            <dd>{summary.invalidRows}</dd>
          </dl>

          {summary.errors.length > 0 && (
            <>
              <h4>Errors</h4>
              <ul className="error-list">
                {summary.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ReservationExcelInput;
