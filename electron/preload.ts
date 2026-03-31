import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  testConnection: (params: { mainApiUrl: string; apiKey: string; propertyId: string }) =>
    ipcRenderer.invoke('test-connection', params),
  testOtherUrl: (params: { baseUrl: string; testPath: string; apiKey: string }) =>
    ipcRenderer.invoke('test-other-url', params),
  apiGet: (params: { url: string; apiKey: string }) =>
    ipcRenderer.invoke('api-get', params),
});
