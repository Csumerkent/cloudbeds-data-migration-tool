import { useState, useRef } from 'react';
import {
  generateReservationTemplate,
  generateProfilesTemplate,
  validateReservationFile,
  ValidationResult,
} from '../../services/excelTemplateService';
import {
  migrateReservations,
  MigrationProgress,
} from '../../services/reservationMigrationService';
import './pages.css';

function ExcelConfiguration() {
  // Reservation state
  const [resFile, setResFile] = useState<File | null>(null);
  const [resValidating, setResValidating] = useState(false);
  const [resSummary, setResSummary] = useState<ValidationResult | null>(null);
  const resInputRef = useRef<HTMLInputElement>(null);

  // Migration state
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  // Profiles state
  const [profFile, setProfFile] = useState<File | null>(null);
  const [profSummary, setProfSummary] = useState<ValidationResult | null>(null);
  const profInputRef = useRef<HTMLInputElement>(null);

  // --- Reservation handlers ---

  const handleResTemplate = () => {
    generateReservationTemplate();
  };

  const handleResFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setResFile(file);
    setResSummary(null);
    setMigrationProgress(null);
  };

  const handleResUpload = async () => {
    if (!resFile) return;
    setResValidating(true);
    setResSummary(null);
    setMigrationProgress(null);
    try {
      const result = await validateReservationFile(resFile);
      setResSummary(result);
    } finally {
      setResValidating(false);
    }
  };

  const handleMigrate = async () => {
    if (!resFile) return;
    setMigrating(true);
    setMigrationProgress(null);
    try {
      const result = await migrateReservations(resFile, (p) => {
        setMigrationProgress({ ...p });
      });
      setMigrationProgress(result);
    } finally {
      setMigrating(false);
    }
  };

  // Can migrate only after validation passes with >0 valid rows
  const canMigrate =
    resSummary != null &&
    resSummary.validRows > 0 &&
    !resValidating &&
    !migrating;

  // --- Profiles handlers ---

  const handleProfTemplate = () => {
    generateProfilesTemplate();
  };

  const handleProfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setProfFile(file);
    setProfSummary(null);
  };

  const handleProfUpload = () => {
    if (!profFile) return;
    setProfSummary({
      fileName: profFile.name,
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      errors: ['Profile validation is not implemented yet. This is a placeholder.'],
    });
  };

  // --- Helpers ---

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success': return '\u2713';
      case 'failed': return '\u2717';
      case 'skipped': return '\u2014';
      case 'sending': return '\u25CB';
      default: return '\u00B7';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return '#2e7d32';
      case 'failed': return '#c62828';
      case 'skipped': return '#f57c00';
      case 'sending': return '#1a73e8';
      default: return '#999';
    }
  };

  return (
    <div className="config-page">
      <h3>Excel Migration Templates</h3>

      {/* ---- Reservation Card ---- */}
      <div className="config-section">
        <h4>Reservation</h4>
        <p className="excel-card-desc">
          Generate a reservation template or upload a filled file for validation and migration.
        </p>

        <div className="excel-card-actions">
          <button className="btn btn-primary" onClick={handleResTemplate}>
            Template
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => resInputRef.current?.click()}
          >
            Upload
          </button>
          <input
            ref={resInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleResFileChange}
          />
        </div>

        {resFile && (
          <div className="excel-file-info">
            <span className="excel-file-name">{resFile.name}</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleResUpload}
              disabled={resValidating || migrating}
            >
              {resValidating ? 'Validating...' : 'Validate'}
            </button>
          </div>
        )}

        {resSummary && (
          <div className="excel-validation-result">
            <dl className="summary-grid">
              <dt>Total Rows</dt>
              <dd>{resSummary.totalRows}</dd>
              <dt>Valid Rows</dt>
              <dd style={{ color: resSummary.validRows > 0 ? '#2e7d32' : undefined }}>
                {resSummary.validRows}
              </dd>
              <dt>Invalid Rows</dt>
              <dd style={{ color: resSummary.invalidRows > 0 ? '#c62828' : undefined }}>
                {resSummary.invalidRows}
              </dd>
            </dl>

            {resSummary.errors.length > 0 && (
              <div className="excel-errors">
                <strong>Issues:</strong>
                <ul className="error-list">
                  {resSummary.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {resSummary.errors.length === 0 && resSummary.validRows > 0 && (
              <div className="status-area status-area--success">
                All {resSummary.validRows} rows passed validation.
              </div>
            )}

            {/* Migrate button */}
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleMigrate}
                disabled={!canMigrate}
              >
                {migrating ? 'Migrating...' : 'Migrate'}
              </button>
              {resSummary.invalidRows > 0 && resSummary.validRows > 0 && (
                <span style={{ marginLeft: 10, fontSize: '0.8rem', color: '#666' }}>
                  Only valid rows will be sent.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Migration progress */}
        {migrationProgress && (
          <div className="config-section" style={{ marginTop: 16 }}>
            <h4>Migration Results</h4>

            {/* Progress bar */}
            <div className="migration-progress-bar-bg">
              <div
                className="migration-progress-bar-fill"
                style={{
                  width: migrationProgress.total > 0
                    ? `${(migrationProgress.completed / migrationProgress.total) * 100}%`
                    : '0%',
                }}
              />
            </div>
            <div className="migration-progress-text">
              {migrationProgress.completed} / {migrationProgress.total} rows processed
              {migrationProgress.completed === migrationProgress.total && ' — done'}
            </div>

            {/* Summary counts */}
            <dl className="summary-grid" style={{ marginTop: 8 }}>
              <dt>Succeeded</dt>
              <dd style={{ color: '#2e7d32' }}>{migrationProgress.succeeded}</dd>
              <dt>Failed</dt>
              <dd style={{ color: migrationProgress.failed > 0 ? '#c62828' : undefined }}>
                {migrationProgress.failed}
              </dd>
            </dl>

            {/* Row-level results table */}
            <div className="scrollable-list" style={{ maxHeight: 300 }}>
              <table className="compact-table">
                <thead>
                  <tr>
                    <th style={{ width: 50 }}>Row</th>
                    <th style={{ width: 30 }}></th>
                    <th style={{ width: 70 }}>Status</th>
                    <th>Message</th>
                  </tr>
                </thead>
                <tbody>
                  {migrationProgress.rows.map((r) => (
                    <tr key={r.rowNumber}>
                      <td>{r.rowNumber}</td>
                      <td style={{ color: statusColor(r.status), fontWeight: 700, textAlign: 'center' }}>
                        {statusIcon(r.status)}
                      </td>
                      <td style={{ color: statusColor(r.status), textTransform: 'capitalize' }}>
                        {r.status}
                      </td>
                      <td>{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---- Profiles Card ---- */}
      <div className="config-section">
        <h4>Profiles</h4>
        <p className="excel-card-desc">
          Generate a profiles template or upload a filled file for validation.
          <span className="excel-placeholder-badge">Placeholder</span>
        </p>

        <div className="excel-card-actions">
          <button className="btn btn-primary" onClick={handleProfTemplate}>
            Template
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => profInputRef.current?.click()}
          >
            Upload
          </button>
          <input
            ref={profInputRef}
            type="file"
            accept=".xlsx"
            style={{ display: 'none' }}
            onChange={handleProfFileChange}
          />
        </div>

        {profFile && (
          <div className="excel-file-info">
            <span className="excel-file-name">{profFile.name}</span>
            <button className="btn btn-primary btn-sm" onClick={handleProfUpload}>
              Validate
            </button>
          </div>
        )}

        {profSummary && (
          <div className="excel-validation-result">
            {profSummary.errors.length > 0 && (
              <div className="status-area status-area--idle">
                {profSummary.errors[0]}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExcelConfiguration;
