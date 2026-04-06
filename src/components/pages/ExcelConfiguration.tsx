import { useState, useRef } from 'react';
import {
  generateReservationTemplate,
  generateProfilesTemplate,
  validateReservationFile,
  ValidationResult,
} from '../../services/excelTemplateService';
import './pages.css';

function ExcelConfiguration() {
  // Reservation state
  const [resFile, setResFile] = useState<File | null>(null);
  const [resValidating, setResValidating] = useState(false);
  const [resSummary, setResSummary] = useState<ValidationResult | null>(null);
  const resInputRef = useRef<HTMLInputElement>(null);

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
  };

  const handleResUpload = async () => {
    if (!resFile) return;
    setResValidating(true);
    setResSummary(null);
    try {
      const result = await validateReservationFile(resFile);
      setResSummary(result);
    } finally {
      setResValidating(false);
    }
  };

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

  return (
    <div className="config-page">
      <h3>Excel Migration Templates</h3>

      {/* ---- Reservation Card ---- */}
      <div className="config-section">
        <h4>Reservation</h4>
        <p className="excel-card-desc">
          Generate a reservation template or upload a filled file for validation.
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
              disabled={resValidating}
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
