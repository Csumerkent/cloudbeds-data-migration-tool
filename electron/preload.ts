import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal API to the renderer process.
// Extend this as IPC channels are added for migration features.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  testConnection: (params: { mainApiUrl: string; apiKey: string; propertyId: string }) =>
    ipcRenderer.invoke('test-connection', params),
});
