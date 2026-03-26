import { contextBridge } from 'electron';

// Expose a minimal API to the renderer process.
// Extend this as IPC channels are added for migration features.
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
});
