import { loadApiConfig } from './apiConfigurationService';
import { debug, info, error as logError } from './debugLogger';

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
    logError('SourceConfig', 'request', 'API configuration not saved');
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', sources: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  const url = `${base}/getSources?propertyIDs=${encodeURIComponent(propertyId)}`;

  // --- Request stage ---
  debug('SourceConfig', 'request', 'Request details', { url, propertyId });
  info('SourceConfig', 'request', 'Fetch started', { url, propertyId });

  let result;
  try {
    result = await window.electronAPI.apiGet({ url, apiKey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('SourceConfig', 'error', 'Fetch threw exception', {
      'error.message': msg,
      'error.stack': err instanceof Error ? err.stack : undefined,
      url,
      propertyId,
    });
    return { success: false, message: `Fetch failed: ${msg}`, sources: [] };
  }

  // --- Response stage ---
  debug('SourceConfig', 'response', 'Raw response received', {
    ok: result.ok,
    status: result.status,
    hasData: result.data != null,
    typeofData: typeof result.data,
    error: result.error,
  });

  if (!result.ok || !result.data) {
    const msg = result.error
      ? `Failed to fetch sources. ${result.error}`
      : `Failed to fetch sources. (HTTP ${result.status})`;
    logError('SourceConfig', 'response', msg);
    return { success: false, message: msg, sources: [] };
  }

  const body = result.data as { success?: boolean; data?: unknown };
  const responseData = body.data;
  const nestedSourceRows = Array.isArray(responseData) ? responseData[0] : undefined;

  debug('SourceConfig', 'response', 'Body inspection', {
    'response.success': body.success,
    'Array.isArray(response.data)': Array.isArray(responseData),
    'Array.isArray(response.data?.[0])': Array.isArray(nestedSourceRows),
    'response.data length': Array.isArray(responseData) ? responseData.length : 'N/A',
    'response.data[0] length': Array.isArray(nestedSourceRows) ? nestedSourceRows.length : 'N/A',
  });

  if (!body.success) {
    logError('SourceConfig', 'response', 'API returned success=false');
    return { success: false, message: 'API returned success=false.', sources: [] };
  }

  // --- Parse stage ---
  info('SourceConfig', 'parse', 'Source parse started');

  const rawSources = Array.isArray(nestedSourceRows)
    ? (nestedSourceRows as Array<Record<string, unknown>>)
    : [];

  debug('SourceConfig', 'parse', 'Parsed source rows from response.data[0]', {
    'parsed source count': rawSources.length,
    'first 5 parsed rows': rawSources.slice(0, 5),
    'keys of first 3 rows': rawSources.slice(0, 3).map((row) => Object.keys(row)),
  });

  if (!Array.isArray(rawSources) || rawSources.length === 0) {
    logError('SourceConfig', 'parse', 'No sources extracted from response.data[0]', {
      'Array.isArray(response.data)': Array.isArray(responseData),
      'Array.isArray(response.data?.[0])': Array.isArray(nestedSourceRows),
      'response.data length': Array.isArray(responseData) ? responseData.length : 'N/A',
      'response.data[0] sample': nestedSourceRows,
    });
    return { success: false, message: 'No sources found in API response.', sources: [] };
  }

  // --- Validation stage ---
  const sources: CloudbedsSource[] = [];
  let invalidCount = 0;
  const invalidExamples: Array<Record<string, unknown>> = [];

  for (const s of rawSources) {
    const id = s.sourceID;
    const name = s.sourceName;
    if (id != null && name != null && String(id) && String(name)) {
      sources.push({
        sourceID: String(id),
        sourceName: String(name),
        isThirdParty: Boolean(s.isThirdParty),
        status: String(s.status ?? ''),
        paymentCollect: String(s.paymentCollect ?? ''),
      });
    } else {
      invalidCount++;
      if (invalidExamples.length < 3) invalidExamples.push(s);
    }
  }

  debug('SourceConfig', 'validation', 'Source validation complete', {
    validCount: sources.length,
    invalidCount,
    invalidExamples,
    first5Valid: sources.slice(0, 5).map((s) => ({ sourceID: s.sourceID, sourceName: s.sourceName })),
  });

  // Persist per property
  saveSourcesCache(propertyId, sources);
  info('SourceConfig', 'persist', `Saved ${sources.length} sources to cache for property ${propertyId}`);

  info('SourceConfig', 'complete', `Fetch success — ${sources.length} sources`);
  return { success: true, message: `Fetched ${sources.length} sources from API.`, sources };
}

// --- Resolve source ID by name (case-insensitive exact match) ---

export function resolveSourceId(sources: CloudbedsSource[], name: string): string {
  if (!Array.isArray(sources)) return '';
  const lower = name.trim().toLowerCase();
  const match = sources.find((s) => typeof s?.sourceName === 'string' && s.sourceName.trim().toLowerCase() === lower);
  return match ? match.sourceID : '';
}
