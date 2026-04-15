// ---------------------------------------------------------------------------
// chunkValidator — single-pass validate + normalize one chunk
// ---------------------------------------------------------------------------
// Produces two cache files per chunk:
//   validation  — valid row numbers + per-row issue lists + stats
//   normalized  — array of { rowNumber, payload } for rows that passed
//
// The two-output design means the executor never re-normalizes; it reads the
// normalized cache and calls sendReservationPayload directly.

import { buildPayload } from '../reservationMigrationService';
import {
  loadRoomDataCache,
  resolveRoomTypeId,
} from '../roomConfigurationService';
import {
  loadSourcesCache,
  loadSourceDefaults,
} from '../sourceConfigurationService';
import {
  loadRatesCache,
  loadRateDefaults,
} from '../rateConfigurationService';
import { loadApiConfig } from '../apiConfigurationService';
import { warn } from '../debugLogger';
import type { ValidationChunk, NormalizedChunk } from './types';

// Re-export the result shape so callers can type it without importing from the
// migration service directly.
export type { ValidationChunk, NormalizedChunk };

/**
 * Validate and normalize a pre-loaded chunk of rows (already read from disk).
 * `startExcelRow` is the Excel row number of the first data row in the chunk
 * (header = row 1, so the first data row is row 2).
 *
 * Returns both the validation and normalized caches so the caller can write
 * them to disk and update the manifest in one atomic step.
 */
export function validateChunk(
  chunkIndex: number,
  rows: Record<string, string>[],
  startExcelRow: number,
  verbose = false,
): { validation: ValidationChunk; normalized: NormalizedChunk } {
  const config = loadApiConfig();
  if (!config) {
    throw new Error('API configuration not saved. Cannot validate chunk without propertyId.');
  }
  const { propertyId } = config;

  const roomCache = loadRoomDataCache(propertyId);
  const roomTypes = roomCache?.roomTypes ?? [];
  const sources = loadSourcesCache(propertyId) ?? [];
  const sourceDefaults = loadSourceDefaults(propertyId);
  const rates = loadRatesCache(propertyId) ?? [];
  const rateDefaults = loadRateDefaults(propertyId);

  if (roomTypes.length === 0) {
    warn('stagedImport', 'chunkValidator', `Chunk ${chunkIndex}: no room types cached — validation may produce false failures`);
  }

  const validRowNumbers: number[] = [];
  const rowIssues: Record<number, string[]> = {};
  const normalizedRows: NormalizedChunk['rows'] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = startExcelRow + i; // Excel row number (1-indexed, header=1)

    const result = buildPayload(
      row,
      rowNumber,
      propertyId,
      roomTypes,
      sources,
      sourceDefaults,
      rates,
      rateDefaults,
      verbose,
    );

    if (result.payload) {
      validRowNumbers.push(rowNumber);
      normalizedRows.push({ rowNumber, payload: result.payload });
    } else {
      rowIssues[rowNumber] = [result.error ?? 'Validation failed'];
    }
  }

  // Warn about any room-type resolution failures in a batch log rather than
  // row-by-row so the Migration tab stays readable.
  const failCount = rows.length - validRowNumbers.length;
  if (failCount > 0) {
    warn('stagedImport', 'chunkValidator', `Chunk ${chunkIndex}: ${failCount}/${rows.length} rows failed validation`, {
      chunkIndex, valid: validRowNumbers.length, invalid: failCount,
    });
  }

  const validation: ValidationChunk = {
    chunkIndex,
    validRowNumbers,
    rowIssues,
    stats: { valid: validRowNumbers.length, invalid: failCount },
  };

  const normalized: NormalizedChunk = {
    chunkIndex,
    rows: normalizedRows,
  };

  return { validation, normalized };
}

/**
 * Convenience: resolveRoomTypeId is already exported from roomConfigurationService
 * but re-exported here so consumers of the staged-import layer don't need to
 * reach into the main service tree.
 */
export { resolveRoomTypeId };
