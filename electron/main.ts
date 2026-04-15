import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import readline from 'node:readline';

const DIST = path.join(__dirname, '../dist');
const DIST_ELECTRON = path.join(__dirname);

let mainWindow: BrowserWindow | null = null;

async function parseResponseBody(response: Response): Promise<{ data: unknown; rawText?: string }> {
  const rawText = await response.text();
  if (!rawText) {
    return { data: null, rawText: '' };
  }

  try {
    return { data: JSON.parse(rawText), rawText };
  } catch {
    return { data: null, rawText };
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Cloudbeds Data Migration Tool',
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Test main Cloudbeds API connection
ipcMain.handle(
  'test-connection',
  async (_event, params: { mainApiUrl: string; apiKey: string; propertyId: string }) => {
    const url = `${params.mainApiUrl.replace(/\/+$/, '')}/getHotelDetails?propertyID=${encodeURIComponent(params.propertyId)}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': params.apiKey,
          accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          return { success: false, message: 'Invalid API key.' };
        }
        if (response.status === 404) {
          return { success: false, message: 'Invalid property ID.' };
        }
        return { success: false, message: `Connection failed. (HTTP ${response.status})` };
      }

      const data = await response.json();
      if (data && data.success === true) {
        return { success: true, message: 'Connection successful.' };
      }
      return { success: false, message: 'Connection failed. Unexpected API response.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, message: `Connection failed. ${msg}` };
    }
  },
);

// IPC: Test reachability of a service base URL
ipcMain.handle(
  'test-other-url',
  async (_event, params: { baseUrl: string; testPath: string; apiKey: string }) => {
    const url = `${params.baseUrl.replace(/\/+$/, '')}${params.testPath}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'x-api-key': params.apiKey,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (response.status >= 500) {
        return { reachable: false, message: `Server error (HTTP ${response.status})` };
      }
      return { reachable: true, message: `Reachable (HTTP ${response.status})` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { reachable: false, message: `Unreachable. ${msg}` };
    }
  },
);

// IPC: Authenticated GET request to a Cloudbeds API endpoint
ipcMain.handle(
  'api-get',
  async (_event, params: { url: string; apiKey: string }) => {
    try {
      const response = await fetch(params.url, {
        method: 'GET',
        headers: {
          'x-api-key': params.apiKey,
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      const { data, rawText } = await parseResponseBody(response);
      return { ok: response.ok, status: response.status, data, rawText };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, status: 0, data: null, error: msg };
    }
  },
);

// IPC: Authenticated POST request to a Cloudbeds API endpoint (form-encoded)
ipcMain.handle(
  'api-post',
  async (_event, params: { url: string; apiKey: string; body: Record<string, string> }) => {
    try {
      const formBody = new URLSearchParams(params.body).toString();
      const response = await fetch(params.url, {
        method: 'POST',
        headers: {
          'x-api-key': params.apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: formBody,
        signal: AbortSignal.timeout(30000),
      });

      const { data, rawText } = await parseResponseBody(response);
      return { ok: response.ok, status: response.status, data, rawText };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { ok: false, status: 0, data: null, error: msg };
    }
  },
);

// ---------------------------------------------------------------------------
// Staged-import IPC handlers
// ---------------------------------------------------------------------------

const stagedImportsRoot = () => path.join(app.getPath('userData'), 'staged-imports');

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function jobDir(jobId: string) {
  return path.join(stagedImportsRoot(), jobId);
}

/** Init (or reopen) a staged-import job directory. Returns the jobId + jobDir. */
ipcMain.handle(
  'staged:init',
  (_event, params: { jobId?: string; sourceFileName: string }) => {
    const jobId = params.jobId ?? `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const dir = jobDir(jobId);
    ensureDir(path.join(dir, 'chunks'));
    return { jobId, jobDir: dir };
  },
);

ipcMain.handle('staged:get-manifest', (_event, params: { jobId: string }) => {
  const file = path.join(jobDir(params.jobId), 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle(
  'staged:write-manifest',
  (_event, params: { jobId: string; manifest: unknown }) => {
    ensureDir(jobDir(params.jobId));
    fs.writeFileSync(
      path.join(jobDir(params.jobId), 'manifest.json'),
      JSON.stringify(params.manifest, null, 2),
      'utf8',
    );
    return { ok: true };
  },
);

ipcMain.handle('staged:list', () => {
  const root = stagedImportsRoot();
  if (!fs.existsSync(root)) return [];
  const entries: unknown[] = [];
  for (const name of fs.readdirSync(root)) {
    const manifestPath = path.join(root, name, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      entries.push(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
    } catch {
      /* skip corrupt manifests */
    }
  }
  return entries;
});

ipcMain.handle(
  'staged:write-chunk',
  (
    _event,
    params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution'; data: unknown },
  ) => {
    const dir = path.join(jobDir(params.jobId), 'chunks');
    ensureDir(dir);
    const idx = String(params.chunkIndex).padStart(5, '0');
    fs.writeFileSync(
      path.join(dir, `chunk-${idx}-${params.kind}.json`),
      JSON.stringify(params.data),
      'utf8',
    );
    return { ok: true };
  },
);

ipcMain.handle(
  'staged:read-chunk',
  (
    _event,
    params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution' },
  ) => {
    const idx = String(params.chunkIndex).padStart(5, '0');
    const file = path.join(jobDir(params.jobId), 'chunks', `chunk-${idx}-${params.kind}.json`);
    if (!fs.existsSync(file)) return null;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  },
);

ipcMain.handle('staged:delete-job', (_event, params: { jobId: string }) => {
  const dir = jobDir(params.jobId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { ok: true };
});

/**
 * Count data rows in a file without loading it entirely:
 *  - CSV: count newlines minus 1 (header) via readline streaming
 *  - XLSX: delegate row count to XLSX.readFile with dense sheets
 * Returns { rowCount, fileType: 'xlsx'|'csv' }.
 */
ipcMain.handle('staged:count-rows', async (_event, params: { filePath: string }) => {
  const ext = path.extname(params.filePath).toLowerCase();
  const fileType = ext === '.csv' ? 'csv' : 'xlsx';

  if (fileType === 'csv') {
    let count = 0;
    let first = true;
    const stream = fs.createReadStream(params.filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    await new Promise<void>((resolve, reject) => {
      rl.on('line', () => {
        if (first) { first = false; return; } // skip header
        count++;
      });
      rl.on('close', resolve);
      rl.on('error', reject);
      stream.on('error', reject);
    });
    return { rowCount: count, fileType };
  }

  // XLSX: use SheetJS to count rows in the first sheet without parsing all
  // cell values.  We only read structure (row/col bounds).
  const XLSX = await import('xlsx');
  const wb = XLSX.readFile(params.filePath, { sheetRows: 0 });
  const wsName = wb.SheetNames[0];
  const ws = wb.Sheets[wsName];
  const ref = ws['!ref'];
  if (!ref) return { rowCount: 0, fileType };
  const range = XLSX.utils.decode_range(ref);
  const rowCount = Math.max(0, range.e.r); // exclude header row
  return { rowCount, fileType };
});

/**
 * Read a slice of rows from a CSV file.
 * `startRow` is 0-based data row (0 = first data row after header).
 * Returns an array of Record<string,string> using the header row as keys.
 */
ipcMain.handle(
  'staged:read-csv-chunk',
  async (
    _event,
    params: { filePath: string; startRow: number; chunkSize: number },
  ): Promise<Record<string, string>[]> => {
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];
    let lineIndex = 0; // 0 = header line

    const stream = fs.createReadStream(params.filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const endRow = params.startRow + params.chunkSize - 1; // inclusive, 0-based

    await new Promise<void>((resolve, reject) => {
      rl.on('line', (line) => {
        if (lineIndex === 0) {
          headers = parseCsvLine(line);
          lineIndex++;
          return;
        }
        const dataIndex = lineIndex - 1; // 0-based data row
        if (dataIndex < params.startRow) {
          lineIndex++;
          return;
        }
        if (dataIndex > endRow) {
          rl.close();
          stream.destroy();
          return;
        }
        const values = parseCsvLine(line);
        const record: Record<string, string> = {};
        headers.forEach((h, i) => { record[h] = values[i] ?? ''; });
        rows.push(record);
        lineIndex++;
      });
      rl.on('close', resolve);
      rl.on('error', reject);
      stream.on('error', reject);
    });

    return rows;
  },
);

/**
 * Read a slice of rows from an XLSX file.
 * `startRow` is 0-based data row (0 = first data row after header).
 * Returns an array of Record<string,string>.
 */
ipcMain.handle(
  'staged:read-xlsx-chunk',
  async (
    _event,
    params: { filePath: string; startRow: number; chunkSize: number },
  ): Promise<Record<string, string>[]> => {
    const XLSX = await import('xlsx');
    // +2 = 1 for header + 1 because sheetRows is inclusive count from row 1
    const sheetRows = params.startRow + params.chunkSize + 1;
    const wb = XLSX.readFile(params.filePath, { sheetRows, dense: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const all: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, {
      defval: '',
      raw: false,
    });
    return all.slice(params.startRow, params.startRow + params.chunkSize);
  },
);

/**
 * Minimal RFC 4180-compatible CSV line parser.
 * Handles double-quoted fields with embedded commas and escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (i === line.length) {
      result.push('');
      break;
    }
    if (line[i] === '"') {
      i++;
      let field = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      result.push(field);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) {
        result.push(line.slice(i));
        break;
      }
      result.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return result;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
