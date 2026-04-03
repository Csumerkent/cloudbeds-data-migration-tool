import { loadApiConfig } from './apiConfigurationService';
import { info, error as logError } from './debugLogger';

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
    return { success: false, message: 'Invalid date format. Use YYYY-MM-DD.', rates: [] };
  }

  const config = loadApiConfig();
  if (!config) {
    logError('RateConfig', 'API configuration not saved');
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', rates: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  const url = `${base}/getRatePlans?propertyIDs=${encodeURIComponent(propertyId)}&startDate=${startDate}&endDate=${endDate}`;

  info('RateConfig', 'Fetch started', { url, startDate, endDate });

  const result = await window.electronAPI.apiGet({ url, apiKey });

  if (!result.ok || !result.data) {
    const msg = result.error
      ? `Failed to fetch rates. ${result.error}`
      : `Failed to fetch rates. (HTTP ${result.status})`;
    logError('RateConfig', msg);
    return { success: false, message: msg, rates: [] };
  }

  const body = result.data as {
    success?: boolean;
    data?: unknown;
  };

  if (!body.success) {
    logError('RateConfig', 'API returned success=false');
    return { success: false, message: 'Unexpected rates response format.', rates: [] };
  }

  // Response can be flat array or nested — handle both safely
  const rawPlans = Array.isArray(body.data) ? body.data : [];

  const rates: CloudbedsRateEntry[] = [];
  for (const plan of rawPlans) {
    if (!plan || typeof plan !== 'object') continue;
    const p = plan as Record<string, unknown>;
    const roomTypes = Array.isArray(p.roomTypes) ? p.roomTypes : [];
    for (const rt of roomTypes) {
      if (!rt || typeof rt !== 'object') continue;
      const r = rt as Record<string, unknown>;
      const ratesList = Array.isArray(r.rates) ? r.rates : [];
      for (const rate of ratesList) {
        if (!rate || typeof rate !== 'object') continue;
        const ra = rate as Record<string, unknown>;
        rates.push({
          ratePlanNamePublic: String(p.ratePlanNamePublic ?? ''),
          ratePlanNamePrivate: String(p.ratePlanNamePrivate ?? ''),
          ratePlanID: String(p.ratePlanID ?? ''),
          roomTypeID: String(r.roomTypeID ?? ''),
          roomTypeName: String(r.roomTypeName ?? ''),
          rateID: String(ra.rateID ?? ''),
          isDerived: Boolean(p.isDerived),
          roomRate: String(ra.roomRate ?? ''),
          totalRate: String(ra.totalRate ?? ''),
        });
      }
    }
  }

  // Persist per property
  saveRatesCache(propertyId, rates);

  info('RateConfig', `Fetch success — ${rates.length} rate entries across ${rawPlans.length} rate plans`);

  return { success: true, message: `Fetched ${rates.length} rate entries across ${rawPlans.length} rate plans.`, rates };
}

// --- Resolve rate plan ID by public name (case-insensitive exact match, first match) ---

export function resolveRatePlanId(rates: CloudbedsRateEntry[], name: string): string {
  if (!Array.isArray(rates)) return '';
  const lower = name.trim().toLowerCase();
  const match = rates.find((r) => r.ratePlanNamePublic.trim().toLowerCase() === lower);
  return match ? match.ratePlanID : '';
}
