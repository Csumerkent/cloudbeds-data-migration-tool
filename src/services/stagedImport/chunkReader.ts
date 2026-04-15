// ---------------------------------------------------------------------------
// chunkReader — read a window of rows from XLSX or CSV via IPC
// ---------------------------------------------------------------------------
// The renderer never touches the filesystem. Reading is delegated to the
// Electron main process which streams CSV line-by-line or uses SheetJS for
// XLSX. Rows are returned as Record<string,string> (same shape used by the
// existing migration service).

import type { FileType } from './types';

function api() {
  return (window as unknown as { electronAPI: import('./types').StagedElectronAPI }).electronAPI;
}

/**
 * Read `chunkSize` data rows starting at 0-based `startRow` from the given
 * file. Returns the rows as plain string-keyed records using the file's own
 * header row as keys.
 */
export async function readChunkRows(
  filePath: string,
  fileType: FileType,
  startRow: number,
  chunkSize: number,
): Promise<Record<string, string>[]> {
  if (fileType === 'csv') {
    return api().stagedReadCsvChunk({ filePath, startRow, chunkSize });
  }
  return api().stagedReadXlsxChunk({ filePath, startRow, chunkSize });
}
