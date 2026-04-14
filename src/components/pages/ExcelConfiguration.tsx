import { useEffect, useRef, useState } from 'react';
import {
  generateReservationTemplate,
  generateProfilesTemplate,
  validateReservationFile,
  ValidationResult,
} from '../../services/excelTemplateService';
import {
  migrateReservations,
  MigrationProgress,
  MigrationCancellation,
} from '../../services/reservationMigrationService';
import { info, debug } from '../../services/debugLogger';
import { setPendingDebugFilter, PendingDebugFilter } from '../../services/debugFilterState';
import './pages.css';

const MIGRATION_UI_STORAGE_KEY = 'cloudbeds-excel-migration-ui';

interface PersistedExcelMigrationState {
  resSummary: ValidationResult | null;
  migrationProgress: MigrationProgress | null;
  migrating: boolean;
}

function loadPersistedMigrationState(): PersistedExcelMigrationState {
  const fallback: PersistedExcelMigrationState = {
    resSummary: null,
    migrationProgress: null,
    migrating: false,
  };

  const raw = sessionStorage.getItem(MIGRATION_UI_STORAGE_KEY);
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedExcelMigrationState>;
    return {
      resSummary: parsed.resSummary ?? null,
      migrationProgress: parsed.migrationProgress ?? null,
      migrating: parsed.migrating ?? false,
    };
  } catch {
    return fallback;
  }
}

function persistMigrationState(state: PersistedExcelMigrationState): void {
  sessionStorage.setItem(MIGRATION_UI_STORAGE_KEY, JSON.stringify(state));
}

// Open the Debug Tool page with a prepared filter. Used by the Review
// screen's Invalid Rows link and the Execution screen's "View logs"
// shortcut so users land directly in the right view.
function openDebugToolFiltered(filter: PendingDebugFilter): void {
  setPendingDebugFilter(filter);
  window.dispatchEvent(new CustomEvent('navigate-to-page', { detail: 'Debug Tool' }));
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s - m * 60);
  return `${m}m ${rem}s`;
}

function ExcelConfiguration() {
  const persistedState = loadPersistedMigrationState();
  // Reservation state
  const [resFile, setResFile] = useState<File | null>(null);
  const [resValidating, setResValidating] = useState(false);
  const [resSummary, setResSummary] = useState<ValidationResult | null>(persistedState.resSummary);
  const resInputRef = useRef<HTMLInputElement>(null);

  // Migration state
  const [migrating, setMigrating] = useState(persistedState.migrating);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(persistedState.migrationProgress);
  // Start time of the current migration (null until Migrate is clicked).
  // `elapsed` ticks while running and freezes once the run finishes/stops.
  const [migrationStartedAt, setMigrationStartedAt] = useState<number | null>(null);
  const [migrationElapsedMs, setMigrationElapsedMs] = useState<number>(0);
  // Mutable cancellation handle shared with the migration loop. The Stop
  // button flips `cancelled = true`; the loop checks it between rows / batches.
  const cancellationRef = useRef<MigrationCancellation>({ cancelled: false });

  // Tick elapsed timer while migrating. Stops as soon as `migrating`
  // flips false; `migrationFinishedAt` pins the final duration.
  useEffect(() => {
    if (!migrating || migrationStartedAt == null) return;
    const id = window.setInterval(() => {
      setMigrationElapsedMs(Date.now() - migrationStartedAt);
    }, 500);
    return () => window.clearInterval(id);
  }, [migrating, migrationStartedAt]);

  // Profiles state
  const [profFile, setProfFile] = useState<File | null>(null);
  const [profSummary, setProfSummary] = useState<ValidationResult | null>(null);
  const profInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    persistMigrationState({ resSummary, migrationProgress, migrating });
  }, [resSummary, migrationProgress, migrating]);

  // --- Reservation handlers ---

  const handleResTemplate = () => {
    generateReservationTemplate();
  };

  const handleResFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setResFile(file);
    setResSummary(null);
    // Selecting a new file is one of the only two events that resets results
    // (the other is starting a brand new migration).
    setMigrationProgress(null);
    cancellationRef.current = { cancelled: false };
    persistMigrationState({ resSummary: null, migrationProgress: null, migrating: false });
    if (file) {
      info('Migration', 'upload', `File selected: ${file.name}`, { fileName: file.name, size: file.size });
    }
  };

  const handleResUpload = async () => {
    if (!resFile) return;
    setResValidating(true);
    info('Migration', 'validation', `Starting validation of ${resFile.name}`);
    try {
      const result = await validateReservationFile(resFile);
      setResSummary(result);
      persistMigrationState({ resSummary: result, migrationProgress, migrating });
      info('Migration', 'validation', `Validation complete: ${result.validRows} valid, ${result.invalidRows} invalid out of ${result.totalRows}`, {
        totalRows: result.totalRows, validRows: result.validRows,
        invalidRows: result.invalidRows, errorCount: result.errors.length,
      });
      if (result.errors.length > 0) {
        debug('Migration', 'validation', 'Validation errors', { errors: result.errors.slice(0, 20) });
      }
    } finally {
      setResValidating(false);
    }
  };

  const handleMigrate = async () => {
    if (!resFile) return;
    // Starting a new migration is the other event (besides new file upload)
    // that resets the results display. A fresh cancellation handle is created
    // so a previous Stop click can't pre-cancel this run.
    cancellationRef.current = { cancelled: false };
    setMigrationProgress(null);
    const started = Date.now();
    setMigrationStartedAt(started);
    setMigrationElapsedMs(0);
    setMigrating(true);
    persistMigrationState({ resSummary, migrationProgress: null, migrating: true });
    info('Migration', 'start', `Migration initiated for ${resFile.name}`);
    try {
      const result = await migrateReservations(
        resFile,
        (p) => {
          persistMigrationState({ resSummary, migrationProgress: { ...p }, migrating: true });
          setMigrationProgress({ ...p });
        },
        cancellationRef.current,
        resSummary,
      );
      setMigrationProgress(result);
      persistMigrationState({ resSummary, migrationProgress: result, migrating: false });
      info(
        'Migration',
        'summary',
        result.stopped
          ? `Migration stopped: ${result.succeeded} succeeded, ${result.failed} failed, ${result.total - result.completed} not processed`
          : `Migration finished: ${result.succeeded} succeeded, ${result.failed} failed out of ${result.total}`,
        {
          total: result.total,
          completed: result.completed,
          succeeded: result.succeeded,
          failed: result.failed,
          stopped: !!result.stopped,
        },
      );
    } finally {
      // Use the locally-captured `started` so the duration is correct
      // regardless of when the `migrationStartedAt` state actually
      // flushed through React.
      setMigrationElapsedMs(Date.now() - started);
      setMigrating(false);
    }
  };

  const handleStopMigration = () => {
    if (!migrating) return;
    cancellationRef.current.cancelled = true;
    info('Migration', 'cancel', 'Stop requested by user — finishing in-flight requests then halting');
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
      validRowNumbers: [],
      invalidRowNumbers: [],
      rowIssues: {},
    });
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
            {/* Compact execution readiness. When every row is valid we
                collapse the dl entirely and show a single success line so
                the eye lands straight on Migrate. When some rows are
                invalid we keep totals + a clickable Invalid Rows count
                that deep-links into the Debug Tool filtered to this
                file — no error list is rendered inline. */}
            {resSummary.invalidRows === 0 && resSummary.validRows > 0 ? (
              <div className="status-area status-area--success">
                Ready to migrate — all {resSummary.validRows} rows passed validation.
              </div>
            ) : (
              <>
                <dl className="summary-grid">
                  <dt>File</dt>
                  <dd>{resSummary.fileName}</dd>
                  <dt>Total Rows</dt>
                  <dd>{resSummary.totalRows}</dd>
                  <dt>Valid Rows</dt>
                  <dd style={{ color: resSummary.validRows > 0 ? '#2e7d32' : undefined }}>
                    {resSummary.validRows}
                  </dd>
                  <dt>Invalid Rows</dt>
                  <dd>
                    {resSummary.invalidRows > 0 ? (
                      <button
                        type="button"
                        className="link-button"
                        style={{ color: '#c62828', fontWeight: 600 }}
                        onClick={() => openDebugToolFiltered({
                          tab: 'migration',
                          level: 'WARN',
                          search: resSummary.fileName,
                        })}
                        title="Open the Debug Tool filtered to validation issues for this file"
                      >
                        {resSummary.invalidRows} — view details
                      </button>
                    ) : (
                      <span>0</span>
                    )}
                  </dd>
                </dl>
                {resSummary.validRows === 0 && (
                  <div className="status-area status-area--idle">
                    No valid rows to migrate. Fix the invalid rows and re-upload.
                  </div>
                )}
              </>
            )}

            {/* Migrate / Stop buttons */}
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                className="btn btn-primary"
                onClick={handleMigrate}
                disabled={!canMigrate}
              >
                {migrating ? 'Migrating...' : 'Migrate'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleStopMigration}
                disabled={!migrating || cancellationRef.current.cancelled}
                title="Stop processing further rows. In-flight requests will finish."
              >
                {cancellationRef.current.cancelled ? 'Stopping...' : 'Stop'}
              </button>
              {resSummary.invalidRows > 0 && resSummary.validRows > 0 && (
                <span style={{ marginLeft: 10, fontSize: '0.8rem', color: '#666' }}>
                  Only valid rows will be sent.
                </span>
              )}
            </div>
          </div>
        )}

        {/* Migration progress — compact summary only. Per-row detail
            lives in the Debug Tool (one click away via "View logs"). */}
        {migrationProgress && (
          <div className="config-section" style={{ marginTop: 16 }}>
            <h4>Execution Status</h4>

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
              {migrationProgress.stopped
                ? ' — stopped by user'
                : !migrating && migrationProgress.completed === migrationProgress.total
                  ? ' — done'
                  : migrating
                    ? ' — in progress'
                    : ''}
            </div>

            {/* Compact summary row: counts on the left, Log shortcut on
                the right. No per-row table — per-row detail is in the
                Debug Tool, pre-filtered to this migration. */}
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span>
                  <strong>Processed:</strong> {migrationProgress.completed}
                </span>
                <span style={{ color: '#2e7d32' }}>
                  <strong>Succeeded:</strong> {migrationProgress.succeeded}
                </span>
                <span style={{ color: migrationProgress.failed > 0 ? '#c62828' : undefined }}>
                  <strong>Failed:</strong> {migrationProgress.failed}
                </span>
                <span style={{ color: '#555' }}>
                  <strong>Duration:</strong> {formatElapsed(migrationElapsedMs)}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => openDebugToolFiltered({
                  tab: 'migration',
                  level: 'ALL',
                  search: resFile?.name ?? '',
                })}
                title="Open the Debug Tool filtered to Migration logs for this file"
              >
                View logs
              </button>
            </div>

            {migrationProgress.stopped && (
              <div className="status-area status-area--idle" style={{ marginTop: 8 }}>
                Migration was stopped. {migrationProgress.total - migrationProgress.completed} row(s) were not processed.
              </div>
            )}
            {migrationProgress.failed > 0 && !migrating && (
              <div style={{ marginTop: 8, fontSize: '0.85rem', color: '#666' }}>
                {migrationProgress.failed} row(s) did not succeed — open <em>View logs</em> to
                inspect per-row results, payloads, and API responses.
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
