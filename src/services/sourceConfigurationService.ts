import { loadApiConfig } from './apiConfigurationService';
import { debug, info, warn, error as logError } from './debugLogger';

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
  info('SourceConfig', 'request', 'Fetch started', { url, propertyId });

  let result;
  try {
    result = await window.electronAPI.apiGet({ url, apiKey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('SourceConfig', 'request', 'Fetch threw exception', { error: msg, stack: err instanceof Error ? err.stack : undefined });
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

  debug('SourceConfig', 'response', 'Body inspection', {
    'body.success': body.success,
    'typeof body.data': typeof body.data,
    'Array.isArray(body.data)': Array.isArray(body.data),
    'body.data length': Array.isArray(body.data) ? body.data.length : 'N/A',
  });

  if (!body.success) {
    logError('SourceConfig', 'response', 'API returned success=false');
    return { success: false, message: 'API returned success=false.', sources: [] };
  }

  // --- Parse stage ---
  info('SourceConfig', 'parse', 'Source parse started');

  // getSources response: data[0] contains the actual source list
  let rawSources: Array<Record<string, unknown>> = [];
  let parseStrategy = 'unknown';

  if (Array.isArray(body.data)) {
    const first = body.data[0];

    debug('SourceConfig', 'parse', 'Inspecting data[0]', {
      'typeof data[0]': typeof first,
      'Array.isArray(data[0])': Array.isArray(first),
      'data[0] length': Array.isArray(first) ? first.length : 'N/A',
      'data[0] sample keys': first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first as Record<string, unknown>).slice(0, 8) : 'N/A',
    });

    if (Array.isArray(first)) {
      // data[0] is the source array
      rawSources = first;
      parseStrategy = 'data[0] is array';
    } else if (first && typeof first === 'object' && !Array.isArray(first)) {
      const firstObj = first as Record<string, unknown>;
      if ('sourceID' in firstObj && 'sourceName' in firstObj) {
        // data itself is a flat array of source objects
        rawSources = body.data as Array<Record<string, unknown>>;
        parseStrategy = 'data is flat source array';
      } else {
        // data[0] might be an object whose values are source objects
        // Try extracting values
        const vals = Object.values(firstObj);
        if (vals.length > 0 && typeof vals[0] === 'object' && vals[0] !== null) {
          const sample = vals[0] as Record<string, unknown>;
          if ('sourceID' in sample && 'sourceName' in sample) {
            rawSources = vals as Array<Record<string, unknown>>;
            parseStrategy = 'data[0] is object-map of sources';
          }
        }
      }
    }
  }

  debug('SourceConfig', 'parse', `Strategy: ${parseStrategy}`, {
    rawSourceCount: rawSources.length,
    firstRowKeys: rawSources.length > 0 ? Object.keys(rawSources[0]).slice(0, 10) : [],
    first3Rows: rawSources.slice(0, 3).map((r) => ({ sourceID: r.sourceID, sourceName: r.sourceName })),
  });

  if (!Array.isArray(rawSources) || rawSources.length === 0) {
    logError('SourceConfig', 'parse', 'No sources extracted', {
      parseStrategy,
      dataType: typeof body.data,
      dataIsArray: Array.isArray(body.data),
      dataLength: Array.isArray(body.data) ? body.data.length : 0,
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
  const match = sources.find((s) => s.sourceName.trim().toLowerCase() === lower);
  return match ? match.sourceID : '';
}
