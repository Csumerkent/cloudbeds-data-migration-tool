import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  testConnection: (params: { mainApiUrl: string; apiKey: string; propertyId: string }) =>
    ipcRenderer.invoke('test-connection', params),
  testOtherUrl: (params: { baseUrl: string; testPath: string; apiKey: string }) =>
    ipcRenderer.invoke('test-other-url', params),
  apiGet: (params: { url: string; apiKey: string }) =>
    ipcRenderer.invoke('api-get', params),
  apiPost: (params: { url: string; apiKey: string; body: Record<string, string> }) =>
    ipcRenderer.invoke('api-post', params),
  menuAction: (action: string) => ipcRenderer.invoke('menu-action', action),
  windowAction: (action: 'minimize' | 'toggle-maximize' | 'close') =>
    ipcRenderer.invoke('window-action', action),
  getWindowState: () => ipcRenderer.invoke('window-state'),
  onWindowStateChanged: (callback: (state: { isMaximized: boolean }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: { isMaximized: boolean }) => callback(state);
    ipcRenderer.on('window-state-changed', listener);
    return () => ipcRenderer.removeListener('window-state-changed', listener);
  },
});
