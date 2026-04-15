import { useState, useRef, useCallback } from 'react';
import { probeFile, createJob, getManifest, saveManifest, updateChunk, repairStuckChunks, writeValidationChunk, writeNormalizedChunk, writeExecutionChunk } from '../../services/stagedImport/jobStore';
import { readChunkRows } from '../../services/stagedImport/chunkReader';
import { validateChunk } from '../../services/stagedImport/chunkValidator';
import { executeChunk, type ChunkExecutionProgress } from '../../services/stagedImport/chunkExecutor';
import type { Manifest, ChunkRecord, ImportMode } from '../../services/stagedImport/types';
import { FILE_SIZE_LIMIT } from '../../services/stagedImport/types';
import type { MigrationCancellation } from '../../services/reservationMigrationService';
import './pages.css';

// Excel row number of the first data row (header = 1, first data row = 2).
const FIRST_DATA_ROW = 2;

type Phase = 'idle' | 'validating' | 'executing' | 'done';

interface ChunkExecProg {
  chunkIndex: number;
  completed: number;
  total: number;
  succeeded: number;
  failed: number;
}

function chunkStateColor(state: ChunkRecord['state']): string {
  switch (state) {
    case 'validated': return '#2e7d32';
    case 'validation_failed': return '#c62828';
    case 'executed': return '#1565c0';
    case 'execute_failed': return '#c62828';
    case 'validating':
    case 'executing': return '#f57c00';
    default: return '#888';
  }
}

function chunkStateLabel(state: ChunkRecord['state']): string {
  switch (state) {
    case 'pending': return 'Pending';
    case 'validating': return 'Validating…';
    case 'validated': return 'Validated';
    case 'validation_failed': return 'Val. failed';
    case 'executing': return 'Executing…';
    case 'executed': return 'Executed';
    case 'execute_failed': return 'Exec. failed';
  }
}

function ControlledBatch() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [execProgress, setExecProgress] = useState<ChunkExecProg | null>(null);
  const [mode, setMode] = useState<ImportMode>('controlled-batch');
  const cancellationRef = useRef<MigrationCancellation>({ cancelled: false });
  const filePathRef = useRef<string>('');

  // ---- file picking --------------------------------------------------------

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // In Electron, File objects from input[type=file] expose a real fs path
    // via the non-standard `path` property.
    const filePath = (file as unknown as { path: string }).path;
    if (!filePath) {
      setStatusMsg('Could not read file path. Make sure you are running the desktop app.');
      return;
    }
    filePathRef.current = filePath;
    setStatusMsg('Probing file…');
    setManifest(null);
    setExecProgress(null);

    try {
      const probe = await probeFile(filePath);
      if (!probe.allowed) {
        setStatusMsg(probe.reason ?? 'File not allowed.');
        return;
      }

      const newManifest = await createJob({
        filePath,
        fileName: file.name,
        fileType: probe.fileType,
        rowCount: probe.rowCount,
        mode,
      });
      setManifest(newManifest);
      setStatusMsg(`File accepted: ${probe.rowCount.toLocaleString()} rows, ${newManifest.totalChunks} chunk(s) of up to ${newManifest.chunkSize.toLocaleString()}.`);
      setPhase('idle');
    } catch (err) {
      setStatusMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [mode]);

  // ---- resume existing job ------------------------------------------------

  const handleResumeJob = useCallback(async (jobId: string) => {
    const raw = await getManifest(jobId);
    if (!raw) return;
    const repaired = repairStuckChunks(raw);
    const saved = await saveManifest(repaired);
    filePathRef.current = saved.sourceFilePath;
    setManifest(saved);
    setStatusMsg(`Resumed job ${jobId} (${saved.rowCount.toLocaleString()} rows, ${saved.totalChunks} chunk(s)).`);
    setPhase('idle');
  }, []);

  // ---- validate next chunk ------------------------------------------------

  const nextChunkInState = (m: Manifest, state: ChunkRecord['state']) =>
    m.chunks.find((c) => c.state === state) ?? null;

  const handleValidateNext = useCallback(async () => {
    if (!manifest) return;
    const chunk = nextChunkInState(manifest, 'pending');
    if (!chunk) {
      setStatusMsg('No pending chunks to validate.');
      return;
    }
    setPhase('validating');
    setStatusMsg(`Validating chunk ${chunk.chunkIndex} / ${manifest.totalChunks}…`);
    cancellationRef.current = { cancelled: false };

    let updated = await updateChunk(manifest, chunk.chunkIndex, { state: 'validating' });
    setManifest(updated);

    try {
      const rows = await readChunkRows(
        filePathRef.current,
        manifest.fileType,
        chunk.startRow,
        chunk.endRow - chunk.startRow + 1,
      );
      // startExcelRow: header=1, first data row=2. chunk.startRow is 0-based data index.
      const startExcelRow = FIRST_DATA_ROW + chunk.startRow;
      const { validation, normalized } = validateChunk(
        chunk.chunkIndex,
        rows,
        startExcelRow,
        /* verbose */ manifest.rowCount <= 1000,
      );

      await writeValidationChunk(manifest.jobId, validation);
      await writeNormalizedChunk(manifest.jobId, normalized);

      const newState = validation.stats.invalid > 0 ? 'validation_failed' : 'validated';
      updated = await updateChunk(updated, chunk.chunkIndex, {
        state: newState,
        validRowCount: validation.stats.valid,
        invalidRowCount: validation.stats.invalid,
        validationAt: new Date().toISOString(),
      });
      setManifest(updated);
      setStatusMsg(
        `Chunk ${chunk.chunkIndex} validated: ${validation.stats.valid} valid, ${validation.stats.invalid} invalid.` +
        (validation.stats.invalid > 0 ? ' State = validation_failed (can still execute valid rows).' : ''),
      );
    } catch (err) {
      updated = await updateChunk(updated, chunk.chunkIndex, { state: 'pending' });
      setManifest(updated);
      setStatusMsg(`Validation error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setPhase('idle');
  }, [manifest]);

  // ---- validate all remaining chunks (Standard mode helper) ---------------

  const handleValidateAll = useCallback(async () => {
    if (!manifest) return;
    let current = manifest;
    setPhase('validating');
    cancellationRef.current = { cancelled: false };

    for (const chunk of current.chunks) {
      if (cancellationRef.current.cancelled) break;
      if (chunk.state !== 'pending') continue;

      setStatusMsg(`Validating chunk ${chunk.chunkIndex} / ${current.totalChunks}…`);
      current = await updateChunk(current, chunk.chunkIndex, { state: 'validating' });
      setManifest(current);

      try {
        const rows = await readChunkRows(
          filePathRef.current,
          current.fileType,
          chunk.startRow,
          chunk.endRow - chunk.startRow + 1,
        );
        const startExcelRow = FIRST_DATA_ROW + chunk.startRow;
        const { validation, normalized } = validateChunk(
          chunk.chunkIndex,
          rows,
          startExcelRow,
          current.rowCount <= 1000,
        );
        await writeValidationChunk(current.jobId, validation);
        await writeNormalizedChunk(current.jobId, normalized);
        const newState = validation.stats.invalid > 0 ? 'validation_failed' : 'validated';
        current = await updateChunk(current, chunk.chunkIndex, {
          state: newState,
          validRowCount: validation.stats.valid,
          invalidRowCount: validation.stats.invalid,
          validationAt: new Date().toISOString(),
        });
        setManifest(current);
      } catch (err) {
        current = await updateChunk(current, chunk.chunkIndex, { state: 'pending' });
        setManifest(current);
        setStatusMsg(`Validation error on chunk ${chunk.chunkIndex}: ${err instanceof Error ? err.message : String(err)}`);
        setPhase('idle');
        return;
      }
    }

    setStatusMsg('All chunks validated.');
    setPhase('idle');
  }, [manifest]);

  // ---- execute next chunk -------------------------------------------------

  const handleExecuteNext = useCallback(async () => {
    if (!manifest) return;
    const chunk =
      nextChunkInState(manifest, 'validated') ??
      nextChunkInState(manifest, 'validation_failed');
    if (!chunk) {
      setStatusMsg('No validated chunks ready to execute.');
      return;
    }
    setPhase('executing');
    setStatusMsg(`Executing chunk ${chunk.chunkIndex} / ${manifest.totalChunks}…`);
    cancellationRef.current = { cancelled: false };

    let updated = await updateChunk(manifest, chunk.chunkIndex, { state: 'executing' });
    setManifest(updated);

    try {
      // Re-read the normalized cache written by the validator.
      const normalizedRaw = await (
        window as unknown as { electronAPI: import('../../services/stagedImport/types').StagedElectronAPI }
      ).electronAPI.stagedReadChunk({ jobId: manifest.jobId, chunkIndex: chunk.chunkIndex, kind: 'normalized' });

      if (!normalizedRaw) throw new Error('Normalized cache not found — validate the chunk first.');

      const normalized = normalizedRaw as import('../../services/stagedImport/types').NormalizedChunk;

      const onProgress = (p: ChunkExecutionProgress) => {
        setExecProgress({ chunkIndex: p.chunkIndex, completed: p.completed, total: p.total, succeeded: p.succeeded, failed: p.failed });
      };

      const execChunk = await executeChunk(normalized, manifest.rowCount <= 1000, cancellationRef.current, onProgress);
      await writeExecutionChunk(manifest.jobId, execChunk);

      const succeeded = execChunk.results.filter((r) => r.status === 'success').length;
      const failed = execChunk.results.filter((r) => r.status !== 'success').length;
      const newState = cancellationRef.current.cancelled ? 'validated' : (failed === 0 ? 'executed' : 'execute_failed');

      updated = await updateChunk(updated, chunk.chunkIndex, {
        state: newState,
        succeeded,
        failed,
        executionAt: new Date().toISOString(),
      });

      // Aggregate summary into manifest.
      const allChunks = updated.chunks;
      const totalSucceeded = allChunks.reduce((s, c) => s + (c.succeeded ?? 0), 0);
      const totalFailed = allChunks.reduce((s, c) => s + (c.failed ?? 0), 0);
      const allDone = allChunks.every((c) => c.state === 'executed' || c.state === 'execute_failed');
      updated = await saveManifest({
        ...updated,
        jobStatus: allDone ? 'completed' : 'active',
        summary: { succeeded: totalSucceeded, failed: totalFailed, skipped: 0 },
      });

      setManifest(updated);
      setStatusMsg(`Chunk ${chunk.chunkIndex} executed: ${succeeded} succeeded, ${failed} failed.`);
    } catch (err) {
      updated = await updateChunk(updated, chunk.chunkIndex, { state: 'validated' });
      setManifest(updated);
      setStatusMsg(`Execution error: ${err instanceof Error ? err.message : String(err)}`);
    }
    setExecProgress(null);
    setPhase('idle');
  }, [manifest]);

  // ---- cancel -------------------------------------------------------------

  const handleStop = useCallback(() => {
    cancellationRef.current.cancelled = true;
    setStatusMsg('Stop requested — finishing current sub-batch…');
  }, []);

  // ---- render -------------------------------------------------------------

  const pendingCount = manifest?.chunks.filter((c) => c.state === 'pending').length ?? 0;
  const validatedCount = manifest?.chunks.filter((c) => c.state === 'validated' || c.state === 'validation_failed').length ?? 0;
  const canValidateNext = !!manifest && phase === 'idle' && pendingCount > 0;
  const canExecuteNext = !!manifest && phase === 'idle' && validatedCount > 0;
  const canStop = phase === 'validating' || phase === 'executing';

  return (
    <div className="config-page" style={{ maxWidth: 900 }}>
      <h3>Controlled Batch Import</h3>

      <div className="config-note config-note--compact">
        For large files (&gt;{FILE_SIZE_LIMIT.toLocaleString()} rows, CSV required). Validation and execution proceed
        chunk-by-chunk ({(10_000).toLocaleString()} rows each) so you can inspect results before committing each
        batch. Jobs are persisted on disk and can be resumed after restart.
      </div>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Mode:</label>
        <select
          className="debug-select"
          value={mode}
          onChange={(e) => setMode(e.target.value as ImportMode)}
          disabled={!!manifest}
        >
          <option value="controlled-batch">Controlled Batch — manual step-through</option>
          <option value="standard">Standard — auto-advance all chunks</option>
        </select>
      </div>

      {/* File picker */}
      {!manifest && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Select file (.xlsx ≤ {FILE_SIZE_LIMIT.toLocaleString()} rows, or .csv any size):
          </label>
          <input type="file" accept=".xlsx,.csv" onChange={handleFileChange} />
        </div>
      )}

      {/* Status */}
      {statusMsg && (
        <div className="config-note config-note--compact" style={{ marginBottom: 8 }}>
          {statusMsg}
        </div>
      )}

      {/* Manifest summary */}
      {manifest && (
        <>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12, fontSize: '0.85rem' }}>
            <span><strong>File:</strong> {manifest.sourceFileName}</span>
            <span><strong>Rows:</strong> {manifest.rowCount.toLocaleString()}</span>
            <span><strong>Chunks:</strong> {manifest.totalChunks}</span>
            <span><strong>Mode:</strong> {manifest.mode}</span>
            <span><strong>Status:</strong> {manifest.jobStatus}</span>
            {manifest.summary && (
              <>
                <span style={{ color: '#2e7d32' }}><strong>Succeeded:</strong> {manifest.summary.succeeded}</span>
                <span style={{ color: '#c62828' }}><strong>Failed:</strong> {manifest.summary.failed}</span>
              </>
            )}
          </div>

          {/* Execution in-progress */}
          {execProgress && (
            <div style={{ marginBottom: 8, fontSize: '0.83rem' }}>
              Chunk {execProgress.chunkIndex} — {execProgress.completed} / {execProgress.total} rows
              &nbsp;|&nbsp;✓ {execProgress.succeeded}&nbsp;✗ {execProgress.failed}
            </div>
          )}

          {/* Controls */}
          <div className="debug-controls" style={{ marginBottom: 12 }}>
            {mode === 'controlled-batch' ? (
              <>
                <button className="btn btn-primary" onClick={handleValidateNext} disabled={!canValidateNext}>
                  Validate next chunk
                </button>
                <button className="btn btn-primary" onClick={handleExecuteNext} disabled={!canExecuteNext}>
                  Execute next chunk
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-primary" onClick={handleValidateAll} disabled={!canValidateNext}>
                  Validate all
                </button>
                <button className="btn btn-primary" onClick={handleExecuteNext} disabled={!canExecuteNext}>
                  Execute next chunk
                </button>
              </>
            )}
            {canStop && (
              <button className="btn btn-secondary" onClick={handleStop}>Stop</button>
            )}
            <button
              className="btn btn-secondary"
              onClick={() => { setManifest(null); setStatusMsg(''); setExecProgress(null); setPhase('idle'); }}
              disabled={phase !== 'idle'}
            >
              New job
            </button>
          </div>

          {/* Chunk grid */}
          <div className="scrollable-list" style={{ maxHeight: 360 }}>
            <table className="compact-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>Chunk</th>
                  <th style={{ width: 100 }}>Rows</th>
                  <th style={{ width: 110 }}>State</th>
                  <th style={{ width: 70 }}>Valid</th>
                  <th style={{ width: 70 }}>Invalid</th>
                  <th style={{ width: 70 }}>Succeeded</th>
                  <th style={{ width: 70 }}>Failed</th>
                </tr>
              </thead>
              <tbody>
                {manifest.chunks.map((c) => (
                  <tr key={c.chunkIndex}>
                    <td>{c.chunkIndex}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {c.startRow + 1}–{c.endRow + 1}
                    </td>
                    <td style={{ color: chunkStateColor(c.state), fontWeight: 600, fontSize: '0.78rem' }}>
                      {chunkStateLabel(c.state)}
                    </td>
                    <td>{c.validRowCount ?? '—'}</td>
                    <td>{c.invalidRowCount ?? '—'}</td>
                    <td>{c.succeeded ?? '—'}</td>
                    <td>{c.failed ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resume hint */}
          <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#666' }}>
            Job ID: <code>{manifest.jobId}</code>
            &nbsp;·&nbsp;
            <button
              className="link-button"
              onClick={() => handleResumeJob(manifest.jobId)}
            >
              Reload from disk
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ControlledBatch;
