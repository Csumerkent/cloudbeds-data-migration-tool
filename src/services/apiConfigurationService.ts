interface TestConnectionParams {
  mainApiUrl: string;
  apiKey: string;
  propertyId: string;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
}

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      testConnection: (params: TestConnectionParams) => Promise<TestConnectionResult>;
    };
  }
}

export async function testConnection(
  params: TestConnectionParams,
): Promise<TestConnectionResult> {
  // Validate required fields before making the IPC call
  if (!params.apiKey.trim()) {
    return { success: false, message: 'API Key is required.' };
  }
  if (!params.propertyId.trim()) {
    return { success: false, message: 'Property ID is required.' };
  }
  if (!params.mainApiUrl.trim()) {
    return { success: false, message: 'Main API URL is required.' };
  }

  return window.electronAPI.testConnection(params);
}
