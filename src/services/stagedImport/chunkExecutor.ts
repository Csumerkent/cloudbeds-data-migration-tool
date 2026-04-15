// ---------------------------------------------------------------------------
// chunkExecutor — send one validated + normalized chunk to the API
// ---------------------------------------------------------------------------
// Reads the normalized cache written by chunkValidator, calls
// sendReservationPayload for each row with bounded concurrency, then returns
// the execution results so the caller can write the execution chunk cache and
// update the manifest.

import {
  sendReservationPayload,
  type MigrationRow,
  type MigrationCancellation,
} from '../reservationMigrationService';
import { loadApiConfig } from '../apiConfigurationService';
import { info, debug } from '../debugLogger';
import type { NormalizedChunk, ExecutionChunk } from './types';

const CHUNK_BATCH_SIZE = 50;
const CHUNK_BATCH_CONCURRENCY = 10;

export interface ChunkExecutionProgress {
  chunkIndex: number;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  stopped: boolean;
}

/**
 * Execute a normalized chunk. Rows are sent concurrently in sub-batches of
 * CHUNK_BATCH_CONCURRENCY, with cancellation checked between sub-batches.
 *
 * @param normalized   The normalized cache for this chunk (from chunkValidator)
 * @param verbose      Whether to emit row-level debug logs
 * @param cancellation Optional shared handle; set cancelled=true to stop
 * @param onProgress   Called after each sub-batch with running counts
 */
export async function executeChunk(
  normalized: NormalizedChunk,
  verbose = false,
  cancellation?: MigrationCancellation,
  onProgress?: (p: ChunkExecutionProgress) => void,
): Promise<ExecutionChunk> {
  const config = loadApiConfig();
  if (!config) {
    throw new Error('API configuration not saved. Cannot execute chunk without API config.');
  }
  const { mainApiUrl, apiKey } = config;
  const postUrl = `${mainApiUrl.replace(/\/+$/, '')}/postReservation`;

  const { chunkIndex, rows } = normalized;
  const results: MigrationRow[] = [];
  let succeeded = 0;
  let failed = 0;
  let stopped = false;

  const emitProgress = () => {
    onProgress?.({
      chunkIndex,
      total: rows.length,
      completed: results.length,
      succeeded,
      failed,
      stopped,
    });
  };

  emitProgress();

  debug('stagedImport', 'chunkExecutor', `Chunk ${chunkIndex}: starting execution of ${rows.length} rows`, {
    chunkIndex, rowCount: rows.length, concurrency: CHUNK_BATCH_CONCURRENCY,
  });

  for (let batchStart = 0; batchStart < rows.length; batchStart += CHUNK_BATCH_SIZE) {
    if (cancellation?.cancelled) {
      stopped = true;
      info('stagedImport', 'cancel', `Chunk ${chunkIndex}: execution stopped by user at row ${rows[batchStart]?.rowNumber ?? '?'}`);
      break;
    }

    const batch = rows.slice(batchStart, batchStart + CHUNK_BATCH_SIZE);
    let cursor = 0;
    const workerCount = Math.min(CHUNK_BATCH_CONCURRENCY, batch.length);
    const workers: Promise<void>[] = [];

    for (let w = 0; w < workerCount; w++) {
      workers.push(
        (async () => {
          while (cursor < batch.length) {
            if (cancellation?.cancelled) return;
            const entry = batch[cursor++];
            const mRow = await sendReservationPayload(postUrl, apiKey, entry.payload, entry.rowNumber, verbose);
            results.push(mRow);
            if (mRow.status === 'success') succeeded++;
            else failed++;
          }
        })(),
      );
    }

    await Promise.all(workers);
    emitProgress();

    if (cancellation?.cancelled) {
      stopped = true;
      break;
    }
  }

  info('stagedImport', 'chunkExecutor', `Chunk ${chunkIndex}: done — ${succeeded} succeeded, ${failed} failed, ${stopped ? 'STOPPED' : 'complete'}`, {
    chunkIndex, succeeded, failed, stopped, total: rows.length,
  });

  return { chunkIndex, results };
}
