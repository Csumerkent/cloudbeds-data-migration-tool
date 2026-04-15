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

  // Staged import file-store operations
  stagedInit: (params: { jobId?: string; sourceFileName: string }) =>
    ipcRenderer.invoke('staged:init', params),
  stagedGetManifest: (params: { jobId: string }) =>
    ipcRenderer.invoke('staged:get-manifest', params),
  stagedWriteManifest: (params: { jobId: string; manifest: unknown }) =>
    ipcRenderer.invoke('staged:write-manifest', params),
  stagedList: () =>
    ipcRenderer.invoke('staged:list'),
  stagedWriteChunk: (params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution'; data: unknown }) =>
    ipcRenderer.invoke('staged:write-chunk', params),
  stagedReadChunk: (params: { jobId: string; chunkIndex: number; kind: 'normalized' | 'validation' | 'execution' }) =>
    ipcRenderer.invoke('staged:read-chunk', params),
  stagedDeleteJob: (params: { jobId: string }) =>
    ipcRenderer.invoke('staged:delete-job', params),
  stagedCountRows: (params: { filePath: string }) =>
    ipcRenderer.invoke('staged:count-rows', params),
  stagedReadCsvChunk: (params: { filePath: string; startRow: number; chunkSize: number }) =>
    ipcRenderer.invoke('staged:read-csv-chunk', params),
  stagedReadXlsxChunk: (params: { filePath: string; startRow: number; chunkSize: number }) =>
    ipcRenderer.invoke('staged:read-xlsx-chunk', params),
});
