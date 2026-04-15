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
  type ValidationContext,
  type ValidationResult,
} from '../services/excelTemplateService';
import {
  migrateReservations,
  type MigrationCancellation,
  type MigrationProgress,
  type ReservationMigrationContext,
} from '../services/reservationMigrationService';
import { saveMigrationSession } from '../services/migrationSessionService';
import { info } from '../services/debugLogger';
import type { NavigationFilters } from '../types/navigation';
import './pages/pages.css';

type MigrationVariant = 'reservation' | 'reservation-detail' | 'profiles' | 'finance';
type ReadinessState = 'pending' | 'validated' | 'executing' | 'executed';

interface MigrationPageProps {
  variant: MigrationVariant;
  onNavigate: (item: SidebarItemId, filters?: NavigationFilters) => void;
}

interface VariantContent {
  eyebrow: string;
  title: string;
  description: string;
  badge: string;
  moduleName: 'Reservation' | 'Reservation Detail' | 'Profiles' | 'Finance';
  detailText: string;
  uploadHint: string;
  preparationText: string;
  executionText: string;
  templateAction: () => void;
  validateAction: (file: File, context?: ValidationContext) => Promise<ValidationResult>;
  executeAction?: (
    file: File,
    validation: ValidationResult,
    onProgress: (progress: MigrationProgress) => void,
    context: ReservationMigrationContext,
    cancellation: MigrationCancellation,
  ) => Promise<MigrationProgress>;
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
    executionText: 'Execution remains blocked until the uploaded reservation workbook passes validation. Log remains available for run visibility.',
    templateAction: generateReservationTemplate,
    validateAction: validateReservationFile,
    executeAction: async (file, validation, onProgress, context, cancellation) => {
      return migrateReservations(file, onProgress, {
        validationResult: validation,
        context,
        cancellation,
      });
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
    executionText: 'Execution opens only after the selected reservation detail workbook is validated. Log remains the reporting shortcut.',
    templateAction: generateReservationDetailTemplate,
    validateAction: (file, context) =>
      validateSimpleModuleFile(file, 'Reservation Detail', [
        'Reservation Number',
        'Guest Name',
        'Detail Type',
        'Detail Value',
      ], context),
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
    executionText: 'Execution stays gated until the uploaded profiles workbook passes validation. Log remains available for follow-up.',
    templateAction: generateProfilesTemplate,
    validateAction: (file, context) =>
      validateSimpleModuleFile(file, 'Profiles', ['First Name *', 'Last Name *', 'Email'], context),
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
    executionText: 'Execution remains blocked until the uploaded finance workbook is validated successfully. Log stays here for reporting access.',
    templateAction: generateFinanceTemplate,
    validateAction: (file, context) =>
      validateSimpleModuleFile(file, 'Finance', [
        'Reservation Number',
        'Profile Number',
        'Charge Code',
        'Amount',
      ], context),
  },
};

function createJobId(variant: MigrationVariant): string {
  return `${variant}-${Date.now()}`;
}

function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs < 0) return '0s';
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

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
  const [reviewSummaryCollapsed, setReviewSummaryCollapsed] = useState(false);
  const [jobId, setJobId] = useState(() => createJobId(variant));

  useEffect(() => {
    setSelectedFile(null);
    setValidationResult(null);
    setReviewing(false);
    setReadinessState('pending');
    setPreparationMessage('');
    setExecutionMessage('');
    setMigrationProgress(null);
    setReviewSummaryCollapsed(false);
    setJobId(createJobId(variant));
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

  const navigationBase = useMemo<NavigationFilters>(() => ({
    moduleScope: content.moduleName,
    fileName: selectedFile?.name,
    jobId,
  }), [content.moduleName, jobId, selectedFile?.name]);

  const readinessMessage = useMemo(() => {
    if (!selectedFile) return 'Upload a file to start review.';
    if (reviewing) return 'Review in progress.';
    if (!validationResult) return 'Review the selected file before execution.';
    if (validationSucceeded) return 'Ready for execution.';
    return 'Review found issues that must be checked in Log before execution.';
  }, [reviewing, selectedFile, validationResult, validationSucceeded]);

  const reviewContext = useMemo<ValidationContext>(() => ({
    moduleScope: content.moduleName,
    fileName: selectedFile?.name ?? '',
    jobId,
  }), [content.moduleName, jobId, selectedFile?.name]);

  const executionContext = useMemo<ReservationMigrationContext>(() => ({
    moduleScope: content.moduleName,
    fileName: selectedFile?.name ?? '',
    jobId,
    verboseLogging: (validationResult?.totalRows ?? 0) <= 1000,
  }), [content.moduleName, jobId, selectedFile?.name, validationResult?.totalRows]);

  const handleDownloadTemplate = () => {
    content.templateAction();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleOpenLogs = (extraFilters?: NavigationFilters) => {
    onNavigate('logs', {
      ...navigationBase,
      ...extraFilters,
    });
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const nextJobId = createJobId(variant);
    setJobId(nextJobId);
    setSelectedFile(file);
    setPreparationMessage(`${file.name} uploaded. Review file to validate this selection.`);
    setValidationResult(null);
    setMigrationProgress(null);
    setExecutionMessage('');
    setReadinessState('pending');
    setReviewSummaryCollapsed(false);
    cancellationRef.current = { cancelled: false };

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

    const result = await content.validateAction(selectedFile, {
      ...reviewContext,
      fileName: selectedFile.name,
    });
    setValidationResult(result);
    setReviewing(false);

    const validated = result.invalidRows === 0 && result.validRows > 0;
    setReadinessState(validated ? 'validated' : 'pending');
    setReviewSummaryCollapsed(validated);
    setPreparationMessage(
      validated
        ? `${selectedFile.name} reviewed successfully and is ready for execution.`
        : `${selectedFile.name} has validation issues that should be reviewed in Log before execution.`,
    );
    info(
      content.moduleName,
      'review-file',
      validated ? 'File review completed successfully' : 'File review found issues',
      result,
      {
        moduleScope: content.moduleName,
        fileName: selectedFile.name,
        jobId,
        logKind: validated ? 'validation' : 'invalid_row',
      },
    );
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
      const progress = await content.executeAction(
        selectedFile,
        validationResult,
        (nextProgress) => {
          setMigrationProgress({ ...nextProgress });
        },
        executionContext,
        cancellationRef.current,
      );
      setMigrationProgress(progress);
      setReadinessState('executed');
      setExecutionMessage(
        progress.failed > 0
          ? `${progress.succeeded} rows executed successfully, ${progress.failed} failed.`
          : `Execution completed successfully for ${progress.succeeded} row(s).`,
      );
      if (content.moduleName === 'Reservation') {
        saveMigrationSession(content.moduleName, selectedFile.name, progress);
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 450));
    setReadinessState('executed');
    setExecutionMessage(`${content.moduleName} execution started after successful review. Service execution remains module-specific.`);
    info(content.moduleName, 'execute', 'Module execution triggered after validation', {
      fileName: selectedFile.name,
      validationResult,
    }, {
      moduleScope: content.moduleName,
      fileName: selectedFile.name,
      jobId,
      logKind: 'migration',
    });
  };

  const reviewRows = [
    { label: 'Selected file', value: selectedFile?.name ?? 'No file selected' },
    { label: 'Valid rows', value: validationResult ? String(validationResult.validRows) : '-' },
    { label: 'Invalid rows', value: validationResult ? String(validationResult.invalidRows) : '-' },
    { label: 'Readiness', value: readinessMessage },
  ];

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
      actions={(
        <div className="page-shell__toolbar">
          <button type="button" className="btn btn-primary" onClick={handleDownloadTemplate}>
            Download template
          </button>
        </div>
      )}
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
            ) : (
              <p className="migration-module__hint">{content.uploadHint}</p>
            )
          }
        />

        <ModuleCard
          icon="chart"
          title="Execution Readiness"
          description={content.executionText}
          badge={validationSucceeded ? 'Ready Focus' : undefined}
          stats={[
            { label: 'Validation gate', value: validationSucceeded ? 'Passed' : 'Blocked' },
            { label: 'Execution state', value: readinessState === 'executed' ? 'Completed' : readinessState === 'executing' ? 'Running' : validationSucceeded ? 'Ready' : 'Waiting' },
            { label: 'Log access', value: 'Filtered log available' },
          ]}
          footer={(
            <div className="migration-module__footer-stack">
              {validationSucceeded ? (
                <div className="status-area status-area--success">
                  Review is complete. Execution is now the active step.
                </div>
              ) : null}
              <div className="migration-inline-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleOpenLogs({ migrationLogsOnly: true })}
                >
                  Open Log
                </button>
                <button
                  type="button"
                  className={`btn ${readinessTone}`}
                  onClick={handleExecute}
                  disabled={readinessState === 'executing' || !validationSucceeded}
                >
                  {readinessLabel}
                </button>
              </div>
              {executionMessage ? <div className="status-area status-area--idle">{executionMessage}</div> : null}
            </div>
          )}
        />
      </div>

      {(selectedFile || validationResult) ? (
        <section className={`config-section ${validationSucceeded ? 'config-section--focused' : ''}`}>
          <div className="section-header-row">
            <h4>Review Summary</h4>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setReviewSummaryCollapsed((current) => !current)}
            >
              {reviewSummaryCollapsed ? 'Expand' : 'Collapse'}
            </button>
          </div>

          {reviewSummaryCollapsed ? (
            <div className="status-area status-area--idle">
              Review summary is collapsed. {validationSucceeded ? 'All reviewed rows are valid.' : 'Expand to inspect counts and readiness.'}
            </div>
          ) : (
            <dl className="summary-grid">
              {reviewRows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>
                    {row.label === 'Invalid rows' && validationResult && validationResult.invalidRows > 0 ? (
                      <button
                        type="button"
                        className="summary-link-button"
                        onClick={() => handleOpenLogs({ invalidRowsOnly: true })}
                      >
                        {row.value}
                      </button>
                    ) : (
                      row.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ) : null}

      {migrationProgress ? (
        <section className="config-section">
          <div className="execution-progress-header">
            <h4>Execution Progress</h4>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenLogs({ migrationLogsOnly: true })}
            >
              Open Log
            </button>
          </div>

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

          <div className="execution-progress-summary">
            <div className="execution-progress-summary__stats">
              <span><strong>{migrationProgress.completed}</strong> processed</span>
              <span><strong>{migrationProgress.succeeded}</strong> succeeded</span>
              <span><strong>{migrationProgress.failed}</strong> failed</span>
              <span><strong>{formatDuration(migrationProgress.durationMs)}</strong> batch duration</span>
            </div>
            <div className="execution-progress-summary__status">
              {migrationProgress.stopped
                ? 'Stopped by user'
                : migrationProgress.completed === migrationProgress.total
                  ? 'Execution complete'
                  : 'Execution running'}
            </div>
          </div>
        </section>
      ) : null}
    </PageShell>
  );
}

export default MigrationPage;
