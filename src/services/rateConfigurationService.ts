import { loadApiConfig } from './apiConfigurationService';
import { debug, info, warn, error as logError } from './debugLogger';

// --- Types ---

export interface CloudbedsRateEntry {
  ratePlanNamePublic: string;
  ratePlanNamePrivate: string;
  ratePlanID: string;
  roomTypeID: string;
  roomTypeName: string;
  rateID: string;
  isDerived: boolean;
  roomRate: string;
  totalRate: string;
}

export interface FetchRatesResult {
  success: boolean;
  message: string;
  rates: CloudbedsRateEntry[];
}

// --- Persistence (property-scoped) ---

function storageKey(propertyId: string): string {
  return `cloudbeds-rates-${propertyId}`;
}

export function saveRatesCache(propertyId: string, rates: CloudbedsRateEntry[]): void {
  localStorage.setItem(storageKey(propertyId), JSON.stringify(rates));
}

export function loadRatesCache(propertyId: string): CloudbedsRateEntry[] | null {
  const raw = localStorage.getItem(storageKey(propertyId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as CloudbedsRateEntry[] : null;
  } catch {
    return null;
  }
}

// --- Date validation ---

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

// --- Fetch rates from Cloudbeds ---

export async function fetchRates(startDate: string, endDate: string): Promise<FetchRatesResult> {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    logError('RateConfig', 'request', 'Invalid date format', { startDate, endDate });
    return { success: false, message: 'Invalid date format. Use YYYY-MM-DD.', rates: [] };
  }

  const config = loadApiConfig();
  if (!config) {
    logError('RateConfig', 'request', 'API configuration not saved');
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', rates: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  const url = `${base}/getRatePlans?propertyIDs=${encodeURIComponent(propertyId)}&startDate=${startDate}&endDate=${endDate}`;

  // --- Request stage ---
  info('RateConfig', 'request', 'Fetch started', { url, propertyId, startDate, endDate });

  let result;
  try {
    result = await window.electronAPI.apiGet({ url, apiKey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logError('RateConfig', 'request', 'Fetch threw exception', { error: msg, stack: err instanceof Error ? err.stack : undefined });
    return { success: false, message: `Fetch failed: ${msg}`, rates: [] };
  }

  // --- Response stage ---
  debug('RateConfig', 'response', 'Raw response received', {
    ok: result.ok,
    status: result.status,
    hasData: result.data != null,
    typeofData: typeof result.data,
    error: result.error,
  });

  if (!result.ok || !result.data) {
    const msg = result.error
      ? `Failed to fetch rates. ${result.error}`
      : `Failed to fetch rates. (HTTP ${result.status})`;
    logError('RateConfig', 'response', msg);
    return { success: false, message: msg, rates: [] };
  }

  const body = result.data as { success?: boolean; data?: unknown };

  debug('RateConfig', 'response', 'Body inspection', {
    'body.success': body.success,
    'typeof body.data': typeof body.data,
    'Array.isArray(body.data)': Array.isArray(body.data),
    'body.data length': Array.isArray(body.data) ? body.data.length : 'N/A',
  });

  if (!body.success) {
    logError('RateConfig', 'response', 'API returned success=false');
    return { success: false, message: 'API returned success=false.', rates: [] };
  }

  // --- Parse stage ---
  // API returns a FLAT array — each row already contains all fields directly
  const rawRows = Array.isArray(body.data) ? body.data : [];
  info('RateConfig', 'parse', 'Rate parse started', { rawRowCount: rawRows.length });

  debug('RateConfig', 'parse', 'First 5 raw rows', {
    rows: rawRows.slice(0, 5).map((r: Record<string, unknown>) => ({
      ratePlanNamePublic: r?.ratePlanNamePublic,
      ratePlanID: r?.ratePlanID,
      roomTypeID: r?.roomTypeID,
      roomTypeName: r?.roomTypeName,
      rateID: r?.rateID,
      isDerived: r?.isDerived,
      keys: r ? Object.keys(r).slice(0, 12) : [],
    })),
  });

  // Map flat rows directly to typed entries
  const allRows: CloudbedsRateEntry[] = rawRows
    .filter((r: unknown) => r != null && typeof r === 'object')
    .map((item: unknown) => {
      const r = item as Record<string, unknown>;
      return {
      ratePlanNamePublic: String(r.ratePlanNamePublic ?? ''),
      ratePlanNamePrivate: String(r.ratePlanNamePrivate ?? ''),
      ratePlanID: String(r.ratePlanID ?? ''),
      roomTypeID: String(r.roomTypeID ?? ''),
      roomTypeName: String(r.roomTypeName ?? ''),
      rateID: String(r.rateID ?? ''),
      isDerived: Boolean(r.isDerived),
      roomRate: String(r.roomRate ?? ''),
      totalRate: String(r.totalRate ?? ''),
    };
    });

  // --- Filtering stage ---
  const withPublicName = allRows.filter((r) => r.ratePlanNamePublic.trim() !== '');
  const withPlanId = withPublicName.filter((r) => r.ratePlanID.trim() !== '');
  const withRoomTypeId = withPlanId.filter((r) => r.roomTypeID.trim() !== '');
  const validRates = withRoomTypeId.filter((r) => r.rateID.trim() !== '');

  debug('RateConfig', 'filter', 'Filter step counts', {
    rawRows: rawRows.length,
    mapped: allRows.length,
    withRatePlanNamePublic: withPublicName.length,
    withRatePlanID: withPlanId.length,
    withRoomTypeID: withRoomTypeId.length,
    withRateID: validRates.length,
  });

  debug('RateConfig', 'filter', 'First 10 valid rows', {
    rows: validRates.slice(0, 10).map((r) => ({
      ratePlanNamePublic: r.ratePlanNamePublic,
      ratePlanID: r.ratePlanID,
      roomTypeName: r.roomTypeName,
      roomTypeID: r.roomTypeID,
      rateID: r.rateID,
    })),
  });

  if (allRows.length > 0 && validRates.length === 0) {
    warn('RateConfig', 'filter', 'All rows filtered out', {
      rawRows: rawRows.length,
      mapped: allRows.length,
      sampleDropped: allRows.slice(0, 3).map((r) => ({
        ratePlanNamePublic: r.ratePlanNamePublic || '(empty)',
        ratePlanID: r.ratePlanID || '(empty)',
        roomTypeID: r.roomTypeID || '(empty)',
        rateID: r.rateID || '(empty)',
      })),
    });
  }

  // Persist per property
  saveRatesCache(propertyId, validRates);
  info('RateConfig', 'persist', `Saved ${validRates.length} rate entries to cache for property ${propertyId}`);

  info('RateConfig', 'complete', `Fetch success — ${validRates.length} valid rate entries from ${rawRows.length} raw rows`);
  return { success: true, message: `Fetched ${validRates.length} rate entries from ${rawRows.length} raw rows.`, rates: validRates };
}

// --- Resolve rate plan ID by public name (case-insensitive exact match, first match) ---

export function resolveRatePlanId(rates: CloudbedsRateEntry[], name: string): string {
  if (!Array.isArray(rates)) return '';
  const lower = name.trim().toLowerCase();
  const match = rates.find((r) => r.ratePlanNamePublic.trim().toLowerCase() === lower);
  return match ? match.ratePlanID : '';
}
