import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

const DIST = path.join(__dirname, '../dist');
const DIST_ELECTRON = path.join(__dirname);

let mainWindow: BrowserWindow | null = null;

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

  // In dev mode, Vite dev server URL is injected as env var
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Test Cloudbeds API connection
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
