import { loadApiConfig } from './apiConfigurationService';
import { info, error as logError } from './debugLogger';

// --- Types ---

export interface CloudbedsSource {
  sourceID: string;
  sourceName: string;
  isThirdParty: boolean;
  status: string;
  paymentCollect: string;
}

export interface FetchSourcesResult {
  success: boolean;
  message: string;
  sources: CloudbedsSource[];
}

// --- Persistence (property-scoped) ---

function storageKey(propertyId: string): string {
  return `cloudbeds-sources-${propertyId}`;
}

export function saveSourcesCache(propertyId: string, sources: CloudbedsSource[]): void {
  localStorage.setItem(storageKey(propertyId), JSON.stringify(sources));
}

export function loadSourcesCache(propertyId: string): CloudbedsSource[] | null {
  const raw = localStorage.getItem(storageKey(propertyId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as CloudbedsSource[] : null;
  } catch {
    return null;
  }
}

// --- Fetch sources from Cloudbeds ---

export async function fetchSources(): Promise<FetchSourcesResult> {
  const config = loadApiConfig();
  if (!config) {
    logError('SourceConfig', 'API configuration not saved');
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', sources: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  const url = `${base}/getSources?propertyIDs=${encodeURIComponent(propertyId)}`;

  info('SourceConfig', 'Fetch started', { url });

  const result = await window.electronAPI.apiGet({ url, apiKey });

  if (!result.ok || !result.data) {
    const msg = result.error
      ? `Failed to fetch sources. ${result.error}`
      : `Failed to fetch sources. (HTTP ${result.status})`;
    logError('SourceConfig', msg);
    return { success: false, message: msg, sources: [] };
  }

  const body = result.data as { success?: boolean; data?: unknown };
  if (!body.success) {
    logError('SourceConfig', 'API returned success=false');
    return { success: false, message: 'Unexpected sources response format.', sources: [] };
  }

  // getSources response: data is nested — data[0] contains the actual source list
  let rawSources: Array<Record<string, unknown>> = [];
  if (Array.isArray(body.data)) {
    const first = body.data[0];
    if (Array.isArray(first)) {
      // data[0] is the source array
      rawSources = first;
    } else if (first && typeof first === 'object' && 'sourceID' in (first as Record<string, unknown>)) {
      // Flat array fallback
      rawSources = body.data as Array<Record<string, unknown>>;
    }
  }

  if (!Array.isArray(rawSources) || rawSources.length === 0) {
    logError('SourceConfig', 'No sources found in response', { dataShape: typeof body.data });
    return { success: false, message: 'No sources found in API response.', sources: [] };
  }

  const sources: CloudbedsSource[] = rawSources.map((s) => ({
    sourceID: String(s.sourceID ?? ''),
    sourceName: String(s.sourceName ?? ''),
    isThirdParty: Boolean(s.isThirdParty),
    status: String(s.status ?? ''),
    paymentCollect: String(s.paymentCollect ?? ''),
  }));

  // Persist per property
  saveSourcesCache(propertyId, sources);

  info('SourceConfig', `Fetch success — ${sources.length} sources`);

  return { success: true, message: `Fetched ${sources.length} sources from API.`, sources };
}

// --- Resolve source ID by name (case-insensitive exact match) ---

export function resolveSourceId(sources: CloudbedsSource[], name: string): string {
  if (!Array.isArray(sources)) return '';
  const lower = name.trim().toLowerCase();
  const match = sources.find((s) => s.sourceName.trim().toLowerCase() === lower);
  return match ? match.sourceID : '';
}
