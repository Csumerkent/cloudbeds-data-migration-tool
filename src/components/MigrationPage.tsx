import { useEffect, useMemo, useRef, useState } from 'react';
import PageShell from './PageShell';
import ModuleCard from './ModuleCard';
import type { SidebarItemId } from './Sidebar';
import {
  generateFinanceTemplate,
  generateProfilesTemplate,
  generateReservationDetailTemplate,
  generateReservationTemplate,
  validateReservationFile,
  validateSimpleModuleFile,
  type ValidationResult,
} from '../services/excelTemplateService';
import {
  migrateReservations,
  type MigrationCancellation,
  type MigrationProgress,
} from '../services/reservationMigrationService';
import { info } from '../services/debugLogger';
import { recordMigrationSession } from '../services/migrationSessionStore';
import './pages/pages.css';

type MigrationVariant = 'reservation' | 'reservation-detail' | 'profiles' | 'finance';
type ReadinessState = 'pending' | 'validated' | 'executing' | 'executed';

interface MigrationPageProps {
  variant: MigrationVariant;
  onNavigate: (item: SidebarItemId) => void;
}

interface VariantContent {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  moduleName: string;
  detailText: string;
  uploadHint: string;
  preparationText: string;
  executionText: string;
  templateAction: () => void;
  validateAction: (file: File) => Promise<ValidationResult>;
  executeAction?: (file: File, validation: ValidationResult, onProgress: (progress: MigrationProgress) => void) => Promise<MigrationProgress>;
}

const VARIANT_CONTENT: Record<MigrationVariant, VariantContent> = {
  reservation: {
    eyebrow: 'Migration / Reservation',
    title: 'Reservation Migration',
    description:
      'Use a single operational flow for reservation runs: download the template, review the file, then execute only after the validation pass is complete.',
    badge: 'Operational Runbook',
    moduleName: 'Reservation',
    detailText: 'Primary migration flow with the existing reservation template, validation, and Cloudbeds execution logic.',
    uploadHint: 'Review the completed reservation workbook to validate it before execution.',
    preparationText: 'Prepare the reservation workbook here by uploading the selected file and running validation before any execution step.',
    executionText: 'Execution remains blocked until the uploaded reservation workbook passes validation. Session Log stays available for run visibility.',
    templateAction: generateReservationTemplate,
    validateAction: validateReservationFile,
    executeAction: async (file, validation, onProgress) => {
      return migrateReservations(file, onProgress, { cancelled: false }, validation);
    },
  },
  'reservation-detail': {
    eyebrow: 'Migration / Reservation Detail',
    title: 'Reservation Detail Migration',
    description:
      'Keep reservation detail processing on the same operator rhythm as the main reservation flow, with a clear validation gate before execution.',
    badge: 'Controlled Module',
    moduleName: 'Reservation Detail',
    detailText: 'Detail records are reviewed through the same three-step action flow for cleaner operator handoff.',
    uploadHint: 'Review a Reservation Detail workbook to confirm the expected worksheet structure and rows.',
    preparationText: 'Upload the reservation detail workbook here and validate that selected file before moving into execution.',
    executionText: 'Execution opens only after the selected reservation detail workbook is validated. Session Log remains the reporting shortcut.',
    templateAction: generateReservationDetailTemplate,
    validateAction: (file) =>
      validateSimpleModuleFile(file, 'Reservation Detail', [
        'Reservation Number',
        'Guest Name',
        'Detail Type',
        'Detail Value',
      ]),
  },
  profiles: {
    eyebrow: 'Migration / Profiles',
    title: 'Profiles Migration',
    description:
      'Move profile-related work into a consistent UI flow so operators can download, review, and execute without switching mental models between modules.',
    badge: 'Profile Intake',
    moduleName: 'Profiles',
    detailText: 'Profile execution remains a controlled module, but the operator experience now matches reservation processing.',
    uploadHint: 'Review a Profiles workbook to confirm the expected worksheet structure and rows.',
    preparationText: 'Upload the profiles workbook and validate the currently selected file from this preparation area.',
    executionText: 'Execution stays gated until the uploaded profiles workbook passes validation. Session Log remains available for follow-up.',
    templateAction: generateProfilesTemplate,
    validateAction: (file) =>
      validateSimpleModuleFile(file, 'Profiles', ['First Name *', 'Last Name *', 'Email']),
  },
  finance: {
    eyebrow: 'Migration / Finance',
    title: 'Finance Migration',
    description:
      'Finance operations follow the same validation-first interaction pattern so teams can stage files and execute only when the review step is complete.',
    badge: 'Finance Control',
    moduleName: 'Finance',
    detailText: 'Finance migration uses a lighter validation contract today, while preserving the same operator flow as the rest of the app.',
    uploadHint: 'Review a Finance workbook to confirm the expected worksheet structure and rows.',
    preparationText: 'Use this area to upload the finance workbook and validate that selected file before any execution step.',
    executionText: 'Execution remains blocked until the uploaded finance workbook is validated successfully. Session Log stays here for reporting access.',
    templateAction: generateFinanceTemplate,
    validateAction: (file) =>
      validateSimpleModuleFile(file, 'Finance', [
        'Reservation Number',
        'Profile Number',
        'Charge Code',
        'Amount',
      ]),
  },
};

function MigrationPage({ variant, onNavigate }: MigrationPageProps) {
  const content = VARIANT_CONTENT[variant];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancellationRef = useRef<MigrationCancellation>({ cancelled: false });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [readinessState, setReadinessState] = useState<ReadinessState>('pending');
  const [preparationMessage, setPreparationMessage] = useState<string>('');
  const [executionMessage, setExecutionMessage] = useState<string>('');
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);

  useEffect(() => {
    setSelectedFile(null);
    setValidationResult(null);
    setReviewing(false);
    setReadinessState('pending');
    setPreparationMessage('');
    setExecutionMessage('');
    setMigrationProgress(null);
  }, [variant]);

  const validationSucceeded = !!validationResult && validationResult.invalidRows === 0 && validationResult.validRows > 0;
  const readinessLabel = readinessState === 'executing' ? 'Executing...' : 'Execute';
  const readinessTone = readinessState === 'validated' || readinessState === 'executed'
    ? 'btn-success'
    : readinessState === 'executing'
      ? 'btn-success'
      : 'btn-danger';

  const reviewStatusText = useMemo(() => {
    if (!selectedFile) return 'No file reviewed yet';
    if (reviewing) return 'Review in progress';
    if (!validationResult) return 'File selected and waiting for review';
    if (validationSucceeded) return `${validationResult.validRows} row(s) reviewed successfully`;
    return `${validationResult.invalidRows} row(s) need attention`;
  }, [reviewing, selectedFile, validationResult, validationSucceeded]);

  const handleDownloadTemplate = () => {
    content.templateAction();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    setSelectedFile(file);
    setPreparationMessage(`${file.name} uploaded. Review file to validate this selection.`);
    setValidationResult(null);
    setMigrationProgress(null);
    setExecutionMessage('');
    setReadinessState('pending');

    event.target.value = '';
  };

  const handleReviewClick = async () => {
    if (!selectedFile) {
      setPreparationMessage('Upload file before reviewing.');
      return;
    }

    setReviewing(true);
    setPreparationMessage('');
    setValidationResult(null);
    setMigrationProgress(null);
    setExecutionMessage('');
    setReadinessState('pending');

    const result = await content.validateAction(selectedFile);
    setValidationResult(result);
    setReviewing(false);

    const validated = result.invalidRows === 0 && result.validRows > 0;
    setReadinessState(validated ? 'validated' : 'pending');
    setPreparationMessage(
      validated
        ? `${selectedFile.name} reviewed successfully and is ready for execution.`
        : `${selectedFile.name} has validation issues that must be fixed before execution.`,
    );
    info(content.moduleName, 'review-file', validated ? 'File review completed successfully' : 'File review found issues', result);
  };

  const handleExecute = async () => {
    if (readinessState === 'pending') {
      setExecutionMessage('Review file before execution.');
      return;
    }

    if (!selectedFile || !validationResult) {
      setExecutionMessage('Select and review a file before execution.');
      return;
    }

    setReadinessState('executing');
    setExecutionMessage('');

    if (content.executeAction) {
      cancellationRef.current = { cancelled: false };
      const startedAt = new Date();
      const progress = await content.executeAction(selectedFile, validationResult, (nextProgress) => {
        setMigrationProgress({ ...nextProgress });
      });
      const finishedAt = new Date();
      setMigrationProgress(progress);
      setReadinessState('executed');
      setExecutionMessage(
        progress.failed > 0
          ? `${progress.succeeded} rows executed successfully, ${progress.failed} failed.`
          : `Execution completed successfully for ${progress.succeeded} row(s).`,
      );
      // Publish this run to the reporting session store so the Reports page
      // can surface real guest / reservation data for post-run follow-up.
      if (variant === 'reservation') {
        recordMigrationSession({
          moduleName: content.moduleName,
          fileName: selectedFile.name,
          startedAt,
          finishedAt,
          progress,
        });
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 450));
    setReadinessState('executed');
    setExecutionMessage(`${content.moduleName} execution started after successful review. Service execution remains module-specific.`);
    info(content.moduleName, 'execute', 'Module execution triggered after validation', {
      fileName: selectedFile.name,
      validationResult,
    });
  };

  return (
    <PageShell
      eyebrow={content.eyebrow}
      title={content.title}
      description={content.description}
      badge={content.badge}
      meta={[
        { label: 'Action flow', value: 'Download template -> Review file -> Execute' },
        { label: 'Current file', value: selectedFile?.name ?? 'No file selected' },
        { label: 'Review status', value: reviewStatusText },
      ]}
      actions={
        <div className="page-shell__toolbar">
          <button type="button" className="btn btn-primary" onClick={handleDownloadTemplate}>
            Download template
          </button>
        </div>
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="module-grid module-grid--operations">
        <ModuleCard
          icon="file"
          title="Operational Controls"
          description={content.preparationText}
          stats={[
            { label: 'Active file', value: selectedFile?.name ?? 'Waiting for upload' },
            { label: 'Review outcome', value: validationSucceeded ? 'Validated' : selectedFile ? 'Pending review' : 'No file uploaded' },
            { label: 'Preparation', value: reviewing ? 'Reviewing file' : selectedFile ? 'File selected' : 'Upload required' },
          ]}
          actions={[
            { label: 'Upload file', tone: 'secondary', onClick: handleUploadClick },
            { label: reviewing ? 'Reviewing...' : 'Review file', tone: 'primary', onClick: () => void handleReviewClick() },
          ]}
          footer={
            preparationMessage ? (
              <div className={`status-area status-area--${validationSucceeded ? 'success' : 'idle'}`}>
                {preparationMessage}
              </div>
            ) : validationResult ? (
              <div className="migration-module__summary">
                <div>
                  <strong>{validationResult.validRows}</strong>
                  <span>Valid rows</span>
                </div>
                <div>
                  <strong>{validationResult.invalidRows}</strong>
                  <span>Invalid rows</span>
                </div>
              </div>
            ) : (
              <p className="migration-module__hint">{content.uploadHint}</p>
            )
          }
        />

        <ModuleCard
          icon="chart"
          title="Execution Readiness"
          description={content.executionText}
          stats={[
            { label: 'Validation gate', value: validationSucceeded ? 'Passed' : 'Blocked' },
            { label: 'Execution state', value: readinessState === 'executed' ? 'Started' : readinessState === 'executing' ? 'Running' : 'Waiting' },
            { label: 'Session access', value: 'Session Log available' },
          ]}
          footer={
            <div className="migration-module__footer-stack">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate('reporting')}
              >
                Session Log
              </button>
              <button
                type="button"
                className={`btn ${readinessTone}`}
                onClick={handleExecute}
                disabled={readinessState === 'executing' || !validationSucceeded}
              >
                {readinessLabel}
              </button>
              {executionMessage ? <div className="status-area status-area--idle">{executionMessage}</div> : null}
            </div>
          }
        />
      </div>

      {validationResult ? (
        <section className="config-section">
          <h4>Review Results</h4>
          <dl className="summary-grid">
            <div>
              <dt>File name</dt>
              <dd>{validationResult.fileName}</dd>
            </div>
            <div>
              <dt>Total rows</dt>
              <dd>{validationResult.totalRows}</dd>
            </div>
            <div>
              <dt>Valid rows</dt>
              <dd>{validationResult.validRows}</dd>
            </div>
            <div>
              <dt>Invalid rows</dt>
              <dd>{validationResult.invalidRows}</dd>
            </div>
          </dl>

          {validationResult.errors.length > 0 ? (
            <div className="excel-errors">
              <strong>Review notes</strong>
              <ul className="error-list">
                {validationResult.errors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="status-area status-area--success">
              Review completed successfully. The module is ready for execution.
            </div>
          )}
        </section>
      ) : null}

      {migrationProgress ? (
        <section className="config-section">
          <h4>Execution Progress</h4>
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
          <div
            className="migration-progress-summary"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              marginTop: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div
              className="migration-progress-stats"
              style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem' }}
            >
              <span>
                <strong>Processed:</strong> {migrationProgress.completed} / {migrationProgress.total}
              </span>
              <span style={{ color: '#2e7d32' }}>
                <strong>Succeeded:</strong> {migrationProgress.succeeded}
              </span>
              <span style={{ color: '#c62828' }}>
                <strong>Failed:</strong> {migrationProgress.failed}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onNavigate('logs')}
            >
              View Migration Logs
            </button>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

export default MigrationPage;
