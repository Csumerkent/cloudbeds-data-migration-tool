import { loadApiConfig } from './apiConfigurationService';

// --- Types ---

export interface CloudbedsSource {
  sourceID: string;
  sourceName: string;
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
    return JSON.parse(raw) as CloudbedsSource[];
  } catch {
    return null;
  }
}

// --- Fetch sources from Cloudbeds ---

export async function fetchSources(): Promise<FetchSourcesResult> {
  const config = loadApiConfig();
  if (!config) {
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', sources: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  const url = `${base}/getSources?propertyIDs=${encodeURIComponent(propertyId)}`;

  const result = await window.electronAPI.apiGet({ url, apiKey });

  if (!result.ok || !result.data) {
    return {
      success: false,
      message: result.error
        ? `Failed to fetch sources. ${result.error}`
        : `Failed to fetch sources. (HTTP ${result.status})`,
      sources: [],
    };
  }

  const body = result.data as { success?: boolean; data?: Array<{ sourceID: string | number; sourceName: string }> };
  if (!body.success || !Array.isArray(body.data)) {
    return { success: false, message: 'Unexpected sources response format.', sources: [] };
  }

  const sources: CloudbedsSource[] = body.data.map((s) => ({
    sourceID: String(s.sourceID),
    sourceName: s.sourceName,
  }));

  // Persist per property
  saveSourcesCache(propertyId, sources);

  return { success: true, message: `Loaded ${sources.length} sources.`, sources };
}

// --- Resolve source ID by name (case-insensitive exact match) ---

export function resolveSourceId(sources: CloudbedsSource[], name: string): string {
  const lower = name.trim().toLowerCase();
  const match = sources.find((s) => s.sourceName.trim().toLowerCase() === lower);
  return match ? match.sourceID : '';
}
