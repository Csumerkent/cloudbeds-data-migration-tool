// ---------------------------------------------------------------------------
// jobStore — renderer-side facade over the main-process file store
// ---------------------------------------------------------------------------
// All persistence is delegated to the Electron main process via IPC so that
// the renderer never touches the filesystem directly.  The manifest is the
// source of truth for a job's lifecycle; per-chunk data lives in sibling JSON
// files managed by the chunk services.

import type { Manifest, ChunkRecord, ChunkState, ValidationChunk, NormalizedChunk, ExecutionChunk } from './types';
import { FILE_SIZE_LIMIT } from './types';
import type { FileType } from './types';

const CHUNK_SIZE = 10_000;

function api() {
  return (window as unknown as { electronAPI: import('./types').StagedElectronAPI }).electronAPI;
}

function now() {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// File policy
// ---------------------------------------------------------------------------

export interface FileProbeResult {
  rowCount: number;
  fileType: FileType;
  allowed: boolean;
  reason?: string;
}

/**
 * Probe the file for row count and apply the size policy:
 *  - XLSX or CSV with ≤ FILE_SIZE_LIMIT rows → allowed
 *  - XLSX with > FILE_SIZE_LIMIT rows         → rejected (must export as CSV)
 *  - CSV with > FILE_SIZE_LIMIT rows          → allowed
 */
export async function probeFile(filePath: string): Promise<FileProbeResult> {
  const { rowCount, fileType } = await api().stagedCountRows({ filePath });
  if (fileType === 'xlsx' && rowCount > FILE_SIZE_LIMIT) {
    return {
      rowCount,
      fileType,
      allowed: false,
      reason: `File has ${rowCount.toLocaleString()} rows. XLSX files are limited to ${FILE_SIZE_LIMIT.toLocaleString()} rows. Please export as CSV and try again.`,
    };
  }
  return { rowCount, fileType, allowed: true };
}

// ---------------------------------------------------------------------------
// Job lifecycle
// ---------------------------------------------------------------------------

/**
 * Create a brand-new job manifest for the given file. Returns the initial
 * manifest (already written to disk).
 */
export async function createJob(params: {
  filePath: string;
  fileName: string;
  fileType: FileType;
  rowCount: number;
  mode: Manifest['mode'];
}): Promise<Manifest> {
  const { jobId } = await api().stagedInit({ sourceFileName: params.fileName });
  const totalChunks = Math.ceil(params.rowCount / CHUNK_SIZE);

  const chunks: ChunkRecord[] = Array.from({ length: totalChunks }, (_, i) => {
    const start = i * CHUNK_SIZE;
    return {
      chunkIndex: i + 1,
      startRow: start,
      endRow: Math.min(start + CHUNK_SIZE - 1, params.rowCount - 1),
      state: 'pending' as ChunkState,
    };
  });

  const manifest: Manifest = {
    jobId,
    sourceFilePath: params.filePath,
    sourceFileName: params.fileName,
    fileType: params.fileType,
    rowCount: params.rowCount,
    chunkSize: CHUNK_SIZE,
    totalChunks,
    mode: params.mode,
    jobStatus: 'pending',
    chunks,
    createdAt: now(),
    updatedAt: now(),
  };

  await api().stagedWriteManifest({ jobId, manifest });
  return manifest;
}

export async function getManifest(jobId: string): Promise<Manifest | null> {
  return api().stagedGetManifest({ jobId });
}

export async function listJobs(): Promise<Manifest[]> {
  return api().stagedList();
}

export async function deleteJob(jobId: string): Promise<void> {
  await api().stagedDeleteJob({ jobId });
}

/**
 * Persist manifest changes.  Always refreshes `updatedAt`.
 */
export async function saveManifest(manifest: Manifest): Promise<Manifest> {
  const updated = { ...manifest, updatedAt: now() };
  await api().stagedWriteManifest({ jobId: manifest.jobId, manifest: updated });
  return updated;
}

/**
 * Update a single chunk record inside the manifest and persist.
 */
export async function updateChunk(
  manifest: Manifest,
  chunkIndex: number,
  patch: Partial<ChunkRecord>,
): Promise<Manifest> {
  const chunks = manifest.chunks.map((c) =>
    c.chunkIndex === chunkIndex ? { ...c, ...patch } : c,
  );
  return saveManifest({ ...manifest, chunks });
}

/**
 * On app start, repair any chunk that was interrupted mid-run by resetting it
 * to the last stable state:
 *   validating        → pending
 *   executing         → validated   (re-run execution, normalization is cached)
 */
export function repairStuckChunks(manifest: Manifest): Manifest {
  const chunks = manifest.chunks.map((c) => {
    if (c.state === 'validating') return { ...c, state: 'pending' as ChunkState };
    if (c.state === 'executing') return { ...c, state: 'validated' as ChunkState };
    return c;
  });
  return { ...manifest, chunks };
}

// ---------------------------------------------------------------------------
// Per-chunk cache I/O
// ---------------------------------------------------------------------------

export async function writeValidationChunk(jobId: string, data: ValidationChunk) {
  await api().stagedWriteChunk({ jobId, chunkIndex: data.chunkIndex, kind: 'validation', data });
}

export async function readValidationChunk(jobId: string, chunkIndex: number): Promise<ValidationChunk | null> {
  return (await api().stagedReadChunk({ jobId, chunkIndex, kind: 'validation' })) as ValidationChunk | null;
}

export async function writeNormalizedChunk(jobId: string, data: NormalizedChunk) {
  await api().stagedWriteChunk({ jobId, chunkIndex: data.chunkIndex, kind: 'normalized', data });
}

export async function readNormalizedChunk(jobId: string, chunkIndex: number): Promise<NormalizedChunk | null> {
  return (await api().stagedReadChunk({ jobId, chunkIndex, kind: 'normalized' })) as NormalizedChunk | null;
}

export async function writeExecutionChunk(jobId: string, data: ExecutionChunk) {
  await api().stagedWriteChunk({ jobId, chunkIndex: data.chunkIndex, kind: 'execution', data });
}

export async function readExecutionChunk(jobId: string, chunkIndex: number): Promise<ExecutionChunk | null> {
  return (await api().stagedReadChunk({ jobId, chunkIndex, kind: 'execution' })) as ExecutionChunk | null;
}
