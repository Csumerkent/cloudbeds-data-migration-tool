import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';

const DIST = path.join(__dirname, '../dist');
const DIST_ELECTRON = path.join(__dirname);

let mainWindow: BrowserWindow | null = null;

function sendWindowState() {
  if (!mainWindow) return;
  mainWindow.webContents.send('window-state-changed', {
    isMaximized: mainWindow.isMaximized(),
  });
}

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
    minWidth: 1100,
    minHeight: 760,
    title: 'Cloudbeds Data Migration Tool',
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#d8e8ff',
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.removeMenu();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);

  mainWindow.webContents.on('did-finish-load', () => {
    sendWindowState();
  });
}

ipcMain.handle('menu-action', async (_event, action: string) => {
  if (!mainWindow) return { ok: false };

  switch (action) {
    case 'file:reload-app':
      mainWindow.webContents.reloadIgnoringCache();
      return { ok: true };
    case 'file:exit-app':
      app.quit();
      return { ok: true };
    case 'file:close':
      mainWindow.close();
      return { ok: true };
    case 'edit:undo':
      mainWindow.webContents.undo();
      return { ok: true };
    case 'edit:redo':
      mainWindow.webContents.redo();
      return { ok: true };
    case 'edit:cut':
      mainWindow.webContents.cut();
      return { ok: true };
    case 'edit:copy':
      mainWindow.webContents.copy();
      return { ok: true };
    case 'edit:paste':
      mainWindow.webContents.paste();
      return { ok: true };
    case 'view:reload':
      mainWindow.webContents.reload();
      return { ok: true };
    case 'view:toggle-devtools':
      mainWindow.webContents.toggleDevTools();
      return { ok: true };
    case 'window:minimize':
      mainWindow.minimize();
      return { ok: true };
    case 'window:toggle-maximize':
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
      return { ok: true };
    case 'help:cloudbeds':
      await shell.openExternal('https://www.cloudbeds.com/');
      return { ok: true };
    default:
      return { ok: false };
  }
});

ipcMain.handle('window-action', async (_event, action: 'minimize' | 'toggle-maximize' | 'close') => {
  if (!mainWindow) {
    return { ok: false, isMaximized: false };
  }

  if (action === 'minimize') {
    mainWindow.minimize();
  } else if (action === 'toggle-maximize') {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  } else if (action === 'close') {
    mainWindow.close();
  }

  return { ok: true, isMaximized: mainWindow.isMaximized() };
});

ipcMain.handle('window-state', async () => {
  if (!mainWindow) {
    return { isMaximized: false };
  }

  return { isMaximized: mainWindow.isMaximized() };
});

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
