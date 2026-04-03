import { loadApiConfig } from './apiConfigurationService';

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
    return JSON.parse(raw) as CloudbedsRateEntry[];
  } catch {
    return null;
  }
}

// --- Fetch rates from Cloudbeds ---

export async function fetchRates(): Promise<FetchRatesResult> {
  const config = loadApiConfig();
  if (!config) {
    return { success: false, message: 'API configuration not saved. Please configure and test the API connection first.', rates: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const base = mainApiUrl.replace(/\/+$/, '');
  // Wide date range to capture all rate plans
  const url = `${base}/getRatePlans?propertyIDs=${encodeURIComponent(propertyId)}&startDate=2021-01-01&endDate=2027-01-01`;

  const result = await window.electronAPI.apiGet({ url, apiKey });

  if (!result.ok || !result.data) {
    return {
      success: false,
      message: result.error
        ? `Failed to fetch rates. ${result.error}`
        : `Failed to fetch rates. (HTTP ${result.status})`,
      rates: [],
    };
  }

  const body = result.data as {
    success?: boolean;
    data?: Array<{
      ratePlanID: string | number;
      ratePlanNamePublic: string;
      ratePlanNamePrivate?: string;
      isDerived?: boolean;
      roomTypes?: Array<{
        roomTypeID: string | number;
        roomTypeName: string;
        rates?: Array<{
          rateID: string | number;
          roomRate?: string | number;
          totalRate?: string | number;
        }>;
      }>;
    }>;
  };

  if (!body.success || !Array.isArray(body.data)) {
    return { success: false, message: 'Unexpected rates response format.', rates: [] };
  }

  // Flatten: each rate plan has roomTypes, each roomType has rates with rateID
  const rates: CloudbedsRateEntry[] = [];
  for (const plan of body.data) {
    for (const rt of plan.roomTypes ?? []) {
      for (const rate of rt.rates ?? []) {
        rates.push({
          ratePlanNamePublic: plan.ratePlanNamePublic,
          ratePlanNamePrivate: plan.ratePlanNamePrivate ?? '',
          ratePlanID: String(plan.ratePlanID),
          roomTypeID: String(rt.roomTypeID),
          roomTypeName: rt.roomTypeName,
          rateID: String(rate.rateID),
          isDerived: plan.isDerived ?? false,
          roomRate: String(rate.roomRate ?? ''),
          totalRate: String(rate.totalRate ?? ''),
        });
      }
    }
  }

  // Persist per property
  saveRatesCache(propertyId, rates);

  return { success: true, message: `Loaded ${rates.length} rate entries across ${body.data.length} rate plans.`, rates };
}

// --- Resolve rate plan ID by public name (case-insensitive exact match, first match) ---

export function resolveRatePlanId(rates: CloudbedsRateEntry[], name: string): string {
  const lower = name.trim().toLowerCase();
  const match = rates.find((r) => r.ratePlanNamePublic.trim().toLowerCase() === lower);
  return match ? match.ratePlanID : '';
}
