// --- Types ---

export interface TestConnectionParams {
  mainApiUrl: string;
  apiKey: string;
  propertyId: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
}

export interface TestOtherUrlResult {
  reachable: boolean;
  message: string;
}

export type UrlSlotStatus = 'idle' | 'testing' | 'success' | 'failed';

export interface ApiConfigState {
  apiKey: string;
  propertyId: string;
  mainApiUrl: string;
  otherUrls: string[];
}

export interface ApiGetResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      testConnection: (params: TestConnectionParams) => Promise<TestConnectionResult>;
      testOtherUrl: (params: { baseUrl: string; testPath: string; apiKey: string }) => Promise<TestOtherUrlResult>;
      apiGet: (params: { url: string; apiKey: string }) => Promise<ApiGetResult>;
    };
  }
}

// --- Constants ---

const STORAGE_KEY = 'cloudbeds-api-config';

export const DEFAULT_OTHER_URLS: string[] = [
  'https://api.cloudbeds.com/accounting/v1.0',
  'https://api.cloudbeds.com/fiscal-document/v1',
  'https://api.cloudbeds.com/group-profile/v1',
  'https://api.cloudbeds.com/payments/v2',
  'https://api.cloudbeds.com/datainsights/v1.1',
  '',
  '',
  '',
  '',
  '',
];

export const DEFAULT_MAIN_API_URL = 'https://api.cloudbeds.com/api/v1.3';

// Internal test paths per known service slot — not exposed in UI
const OTHER_URL_TEST_PATHS: Record<number, string> = {
  0: '/internal-transaction-codes', // accounting
  1: '/configs',                    // fiscal-document
  2: '/profiles',                   // group-profile
  3: '/pay-by-link/health',         // payments
  4: '/me/properties',              // datainsights
};

const DEFAULT_TEST_PATH = '/';

// --- Main API test ---

export async function testMainConnection(
  params: TestConnectionParams,
): Promise<TestConnectionResult> {
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

// --- Other URL reachability test ---

export async function testOtherUrl(
  index: number,
  baseUrl: string,
  apiKey: string,
): Promise<TestOtherUrlResult> {
  if (!baseUrl.trim()) {
    return { reachable: false, message: 'URL is empty.' };
  }

  const testPath = OTHER_URL_TEST_PATHS[index] ?? DEFAULT_TEST_PATH;
  return window.electronAPI.testOtherUrl({ baseUrl, testPath, apiKey });
}

// --- Persistence ---

export function saveApiConfig(state: ApiConfigState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadApiConfig(): ApiConfigState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ApiConfigState;
  } catch {
    return null;
  }
}
