// ---------------------------------------------------------------------------
// Staged-import shared types
// ---------------------------------------------------------------------------

export type FileType = 'xlsx' | 'csv';

export type ChunkState =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'validation_failed'
  | 'executing'
  | 'executed'
  | 'execute_failed';

export type JobStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed';

export type ImportMode = 'standard' | 'controlled-batch';

/** Row-count policy limits. */
export const FILE_SIZE_LIMIT = 50_000;

export interface ChunkRecord {
  chunkIndex: number;      // 1-based
  startRow: number;        // 0-based data-row index of first row in chunk
  endRow: number;          // 0-based data-row index of last row in chunk (inclusive)
  state: ChunkState;
  validRowCount?: number;
  invalidRowCount?: number;
  succeeded?: number;
  failed?: number;
  skipped?: number;
  validationAt?: string;
  executionAt?: string;
}

export interface JobSummary {
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface Manifest {
  jobId: string;
  sourceFilePath: string;   // path accessible to the main process
  sourceFileName: string;
  fileType: FileType;
  rowCount: number;
  chunkSize: number;        // validation chunk size (10 000)
  totalChunks: number;
  mode: ImportMode;
  jobStatus: JobStatus;
  chunks: ChunkRecord[];
  createdAt: string;
  updatedAt: string;
  summary?: JobSummary;
}

// ---------------------------------------------------------------------------
// Per-chunk cache shapes (written to disk via IPC)
// ---------------------------------------------------------------------------

export interface ValidationChunk {
  chunkIndex: number;
  validRowNumbers: number[];            // Excel row numbers (1-indexed, header=1)
  rowIssues: Record<number, string[]>;  // rowNumber → list of issue strings
  stats: { valid: number; invalid: number };
}

/** Normalized payload cache: only what buildPayload needs, already cleaned. */
export interface NormalizedChunk {
  chunkIndex: number;
  /** Row number (Excel 1-indexed) → minimal normalized payload fields */
  rows: Array<{ rowNumber: number; payload: Record<string, string> }>;
}

export interface ExecutionChunk {
  chunkIndex: number;
  results: import('../reservationMigrationService').MigrationRow[];
}

// ---------------------------------------------------------------------------
// Renderer-side API surface (matches window.electronAPI shape)
// ---------------------------------------------------------------------------

export interface StagedElectronAPI {
  stagedInit(params: { jobId?: string; sourceFileName: string }): Promise<{ jobId: string; jobDir: string }>;
  stagedGetManifest(params: { jobId: string }): Promise<Manifest | null>;
  stagedWriteManifest(params: { jobId: string; manifest: Manifest }): Promise<{ ok: boolean }>;
  stagedList(): Promise<Manifest[]>;
  stagedWriteChunk(params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution'; data: unknown }): Promise<{ ok: boolean }>;
  stagedReadChunk(params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution' }): Promise<unknown>;
  stagedDeleteJob(params: { jobId: string }): Promise<{ ok: boolean }>;
  stagedCountRows(params: { filePath: string }): Promise<{ rowCount: number; fileType: FileType }>;
  stagedReadCsvChunk(params: { filePath: string; startRow: number; chunkSize: number }): Promise<Record<string, string>[]>;
  stagedReadXlsxChunk(params: { filePath: string; startRow: number; chunkSize: number }): Promise<Record<string, string>[]>;
}
