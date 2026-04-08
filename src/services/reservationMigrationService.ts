import * as XLSX from 'xlsx';
import { loadApiConfig } from './apiConfigurationService';
import type { ValidationResult } from './excelTemplateService';
import { loadRoomDataCache, resolveRoomTypeId, CloudbedsRoomType } from './roomConfigurationService';
import {
  loadSourcesCache,
  evaluateFutureSourceDecision,
  findSourceMatch,
  loadSourceDefaults,
  CloudbedsSource,
  SourceDefaults,
} from './sourceConfigurationService';
import {
  loadRatesCache,
  findRateMatch,
  loadRateDefaults,
  CloudbedsRateEntry,
  RateDefaults,
} from './rateConfigurationService';
import { normalizeGender, normalizeCountry, normalizeEmail, normalizePayment, normalizeSourceKey, normalizeRateKey } from './normalizationHelpers';
import { getCurrentAppDateTime } from './appDateTimeService';
import { info, debug, warn, error as logError } from './debugLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RowStatus = 'pending' | 'sending' | 'success' | 'failed' | 'skipped';
export type MigrationErrorCategory = 'VALIDATION_ERROR' | 'API_ERROR' | 'AVAILABILITY_ERROR' | 'UNKNOWN_ERROR';
export type MigrationFailureStage = 'pre_api' | 'post_api';

export interface MigrationRow {
  rowNumber: number;           // Excel row (1-indexed, header = row 1)
  status: RowStatus;
  message: string;
  errorCategory?: MigrationErrorCategory;
  failureStage?: MigrationFailureStage;
  failureDetails?: string[];
  normalizedEmail?: string;
  finalEmail?: string;
  reservationId?: string;      // Returned by Cloudbeds on success
  payload?: Record<string, string>; // The API payload sent
}

export interface MigrationProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  rows: MigrationRow[];
  stopped?: boolean;           // True when the user pressed Stop
}

/**
 * Mutable cancellation handle. The UI flips `cancelled = true` when the user
 * presses Stop; the migration loop checks this between rows and between
 * batches and exits cleanly. Already-sent API requests are NOT aborted.
 */
export interface MigrationCancellation {
  cancelled: boolean;
}

// Batch + concurrency tuning. Within a batch, up to BATCH_CONCURRENCY rows are
// in-flight at the same time. Batches run sequentially so progress callbacks
// fire at predictable boundaries and so the user can stop cleanly between
// batches without overwhelming the API.
const BATCH_SIZE = 50;
const BATCH_CONCURRENCY = 10;

interface BuildPayloadResult {
  payload: Record<string, string> | null;
  error: string | null;
  errorCategory?: MigrationErrorCategory;
  normalizedEmail: string;
  finalEmail: string;
}

interface ParsedApiError {
  category: MigrationErrorCategory;
  reason: string;
  details: string[];
  responseSummary: string;
}

const AVAILABILITY_PATTERNS = [
  'availability',
  'inventory',
  'no availability',
  'not available',
  'unavailable',
  'sold out',
  'room rate availability',
];

const VALIDATION_PATTERNS = [
  'validation',
  'invalid',
  'required',
  'must be',
  'missing',
  'not allowed',
  'incorrect',
  'malformed',
];

function flattenStructuredDetails(value: unknown, path = '', depth = 0): string[] {
  if (value == null || depth > 4) return [];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [path ? `${path}: ${trimmed}` : trimmed] : [];
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return path ? [`${path}: ${String(value)}`] : [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenStructuredDetails(item, path, depth + 1));
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      return flattenStructuredDetails(child, childPath, depth + 1);
    });
  }
  return [];
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = (value ?? '').trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function collectApiMessages(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const direct = uniqueStrings([
    typeof obj.message === 'string' ? obj.message : '',
    typeof obj.error === 'string' ? obj.error : '',
    typeof obj.detail === 'string' ? obj.detail : '',
    typeof obj.description === 'string' ? obj.description : '',
    typeof obj.summary === 'string' ? obj.summary : '',
  ]);
  const nested = uniqueStrings([
    ...flattenStructuredDetails(obj.errors, 'errors'),
    ...flattenStructuredDetails(obj.validationErrors, 'validationErrors'),
    ...flattenStructuredDetails(obj.errorDetails, 'errorDetails'),
    ...flattenStructuredDetails(obj.details, 'details'),
    ...flattenStructuredDetails(obj.data, 'data'),
  ]);
  return uniqueStrings([...direct, ...nested]);
}

function categorizeFailure(status: number, joinedText: string, hasStructuredValidation: boolean): MigrationErrorCategory {
  const lower = joinedText.toLowerCase();
  if (AVAILABILITY_PATTERNS.some((pattern) => lower.includes(pattern))) {
    return 'AVAILABILITY_ERROR';
  }
  if (
    hasStructuredValidation ||
    status === 400 ||
    status === 422 ||
    VALIDATION_PATTERNS.some((pattern) => lower.includes(pattern))
  ) {
    return 'VALIDATION_ERROR';
  }
  if (joinedText.trim()) {
    return 'API_ERROR';
  }
  return 'UNKNOWN_ERROR';
}

function summarizeResponse(data: unknown, rawText?: string): string {
  if (data && typeof data === 'object') {
    const keys = Object.keys(data as Record<string, unknown>);
    if (keys.length > 0) {
      return `Response keys: ${keys.slice(0, 8).join(', ')}`;
    }
  }
  if (rawText?.trim()) {
    return `Raw response: ${rawText.slice(0, 240)}`;
  }
  return 'No response body returned';
}

function parseApiFailure(status: number, data: unknown, transportError?: string, rawText?: string): ParsedApiError {
  const messages = collectApiMessages(data);
  const hasStructuredValidation =
    !!data &&
    typeof data === 'object' &&
    ['errors', 'validationErrors', 'errorDetails'].some((key) => (data as Record<string, unknown>)[key] != null);
  const firstUsableMessage =
    messages[0]
    || transportError?.trim()
    || (rawText?.trim() ? rawText.trim().slice(0, 240) : '');
  const reason = firstUsableMessage || 'Unknown error — check payload or API response';
  const joinedText = uniqueStrings([reason, transportError, rawText, ...messages]).join(' | ');

  return {
    category: categorizeFailure(status, joinedText, hasStructuredValidation),
    reason,
    details: messages.slice(1, 8),
    responseSummary: summarizeResponse(data, rawText),
  };
}

// ---------------------------------------------------------------------------
// Parse uploaded file into raw row maps
// ---------------------------------------------------------------------------

export function parseReservationFile(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'reservations');
        if (!sheetName) {
          reject(new Error('Reservations sheet not found'));
          return;
        }
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
          defval: '',
          raw: false,
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Build a postReservation payload from one Excel row
// ---------------------------------------------------------------------------

function buildPayload(
  row: Record<string, string>,
  rowIndex: number,
  propertyId: string,
  roomTypes: CloudbedsRoomType[],
  sources: CloudbedsSource[],
  sourceDefaults: SourceDefaults,
  rates: CloudbedsRateEntry[],
  rateDefaults: RateDefaults,
): BuildPayloadResult {
  const get = (header: string): string => (row[header] ?? '').trim();

  // Required fields
  const arrival = get('Arrival *');
  const departure = get('Departure *');
  const firstName = get('First Name *');
  const lastName = get('Last Name *');
  const roomTypeCode = get('Room Type *');
  const country = get('Country *');
  const rawEmail = get('Email *');
  const normalizedEmail = normalizeEmail(rawEmail);
  const finalEmail = normalizedEmail || `migration+${rowIndex}@example.com`;

  if (!arrival || !departure || !firstName || !lastName || !roomTypeCode || !country) {
    debug('Migration', 'payload', `Row ${rowIndex}: missing required fields`, {
      arrival: arrival || '(empty)', departure: departure || '(empty)',
      firstName: firstName || '(empty)', lastName: lastName || '(empty)',
      roomTypeCode: roomTypeCode || '(empty)', country: country || '(empty)',
    });
    return {
      payload: null,
      error: 'Missing required fields',
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
    };
  }

  // Resolve room type
  const roomTypeID = resolveRoomTypeId(roomTypes, roomTypeCode);
  debug('Migration', 'resolve', `Row ${rowIndex}: room type "${roomTypeCode}" → ${roomTypeID || '(not found)'}`, {
    roomTypeCode, roomTypeID, availableTypes: roomTypes.map((r) => r.roomTypeNameShort).slice(0, 10),
  });
  if (!roomTypeID) {
    return {
      payload: null,
      error: `Room type "${roomTypeCode}" not found in Cloudbeds`,
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
    };
  }

  // Apply defaults
  const email = finalEmail;
  const adult = get('Adult *') || '1';
  const child = get('Child') || '0';
  const roomCount = get('Room Count') || '1';

  const trimmedEmail = (rawEmail ?? '').trim();
  const emailChanged = trimmedEmail !== finalEmail;
  const emailContainsNonAscii = /[^\x00-\x7F]/.test(trimmedEmail);
  if (emailChanged || emailContainsNonAscii || normalizedEmail === '') {
    debug('Migration', 'normalize', `Row ${rowIndex}: email "${rawEmail}" → "${normalizedEmail || '(blank)'}"`, {
      raw: rawEmail,
      normalized: normalizedEmail || '(blank)',
      final: finalEmail,
      usedFallback: normalizedEmail === '',
      emailContainsNonAscii,
    });
  }

  // Normalize payment method (credit / ebanking / cash)
  const rawPaymentMethod = get('Payment Method *');
  const paymentMethod = normalizePayment(rawPaymentMethod);
  debug('Migration', 'normalize', `Row ${rowIndex}: payment "${rawPaymentMethod}" → "${paymentMethod}"`, {
    raw: rawPaymentMethod, normalized: paymentMethod,
  });

  // Normalize country to ISO2 (always populated; falls back to TR)
  const countryResult = normalizeCountry(country);
  debug('Migration', 'normalize', `Row ${rowIndex}: country "${country}" → "${countryResult.iso2}"${countryResult.resolved ? '' : ' (fallback)'}`, {
    raw: country, normalized: countryResult.iso2, resolved: countryResult.resolved,
  });
  if (!countryResult.resolved) {
    warn('Migration', 'normalize', `Row ${rowIndex}: country "${country}" not recognized — falling back to TR`, { rowIndex, raw: country });
  }

  // Determine past vs future reservation once (used by both source and rate
  // default selection). Reservations with arrival < today are considered past.
  const today = getCurrentAppDateTime();
  today.setHours(0, 0, 0, 0);
  const arrivalDate = new Date(arrival);
  const isPastReservation = !isNaN(arrivalDate.getTime()) && arrivalDate < today;
  const bucket = isPastReservation ? 'past' : 'future';

  // Rate resolution (scoped to this row's roomTypeID):
  //  1. If Excel rate is filled → exact / normalized / contains match against
  //     configured rates for this room type.
  //  2. If blank or no match → fall back to the configured past/future
  //     default rate name, again scoped to this room type.
  //  3. When a rate is resolved, its `rateID` becomes the `roomRateID` in the
  //     rooms array.
  const rawRateCode = get('Rate Code');
  const normalizedRateKey = normalizeRateKey(rawRateCode);
  const defaultRateName = isPastReservation
    ? rateDefaults.pastRateName
    : rateDefaults.futureRateName;

  let chosenRateName: string | null = null;
  let chosenRoomRateID: string | null = null;
  let rateStrategy: string = 'none';
  let usedDefaultRate = false;

  if (rawRateCode) {
    debug('Migration', 'normalize', `Row ${rowIndex}: rate "${rawRateCode}" → key "${normalizedRateKey}"`, {
      raw: rawRateCode, key: normalizedRateKey,
    });
    const match = findRateMatch(rates, roomTypeID, rawRateCode);
    if (match.rate) {
      chosenRateName = match.rate.ratePlanNamePublic;
      chosenRoomRateID = match.rate.rateID;
      rateStrategy = match.strategy;
    }
  }

  if (!chosenRoomRateID && defaultRateName) {
    const defaultMatch = findRateMatch(rates, roomTypeID, defaultRateName);
    if (defaultMatch.rate) {
      chosenRateName = defaultMatch.rate.ratePlanNamePublic;
      chosenRoomRateID = defaultMatch.rate.rateID;
      rateStrategy = `default-${bucket}:${defaultMatch.strategy}`;
      usedDefaultRate = true;
    }
  }

  debug('Migration', 'resolve', `Row ${rowIndex}: rate resolution → strategy=${rateStrategy}, name="${chosenRateName ?? '(none)'}", roomRateID=${chosenRoomRateID ?? '(none)'}`, {
    rawRate: rawRateCode || '(blank)',
    normalizedRate: normalizedRateKey,
    roomTypeID,
    bucket,
    defaultRateName,
    usedDefault: usedDefaultRate,
    strategy: rateStrategy,
    chosenRateName,
    chosenRoomRateID,
    availableRatesForRoomType: rates
      .filter((r) => r.roomTypeID === roomTypeID)
      .map((r) => ({ ratePlanNamePublic: r.ratePlanNamePublic, rateID: r.rateID }))
      .slice(0, 10),
  });

  if (!chosenRoomRateID) {
    warn('Migration', 'resolve', `Row ${rowIndex}: no rate resolvable for room type ${roomTypeID} (raw="${rawRateCode}", default="${defaultRateName}")`, {
      rowIndex,
      rawRate: rawRateCode,
      normalizedRate: normalizedRateKey,
      roomTypeID,
      defaultRateName,
      bucket,
    });
  }

  // Build rooms/adults/children as JSON arrays (API requires array format).
  //
  // Target structure (form-urlencoded, values are JSON-stringified arrays):
  //   rooms=[{"roomTypeID":"...","quantity":1,"roomRateID":"..."}]
  //   adults=[{"roomTypeID":"...","quantity":1}]
  //   children=[{"roomTypeID":"...","quantity":0}]
  //
  // Only `rooms` entries carry `roomRateID` (and only when a rate was resolved).
  const roomsEntry: Record<string, unknown> = {
    roomTypeID,
    quantity: Number(roomCount) || 1,
  };
  if (chosenRoomRateID) {
    roomsEntry.roomRateID = chosenRoomRateID;
  }
  const roomsArray = JSON.stringify([roomsEntry]);
  const adultsArray = JSON.stringify([{ roomTypeID, quantity: Number(adult) || 1 }]);
  const childrenArray = JSON.stringify([{ roomTypeID, quantity: Number(child) || 0 }]);

  // Build base payload
  const payload: Record<string, string> = {
    propertyID: propertyId,
    startDate: arrival,
    endDate: departure,
    guestFirstName: firstName,
    guestLastName: lastName,
    guestEmail: email,
    guestCountry: countryResult.iso2,
    rooms: roomsArray,
    adults: adultsArray,
    children: childrenArray,
    paymentMethod,
    // Always send sendEmailConfirmation=false during migration so guests
    // never receive a confirmation email for back-filled reservations.
    sendEmailConfirmation: 'false',
  };

  // Source resolution:
  //  - Past reservations use the configured old-reservations source.
  //  - Future reservations only include sourceID when the Excel source resolves
  //    to an active third-party source. Otherwise sourceID is omitted.
  const rawSourceCode = get('Source Code');
  const normalizedSourceKey = normalizeSourceKey(rawSourceCode);

  let chosenSourceName: string | null = null;
  let chosenSourceID: string | null = null;
  let strategyUsed: string = 'none';
  let sourceDecisionReason:
    | 'PAST_CONFIGURED_OLD_SOURCE_APPLIED'
    | 'FUTURE_THIRD_PARTY_ACTIVE_SOURCE_INCLUDED'
    | 'NON_THIRD_PARTY_FUTURE_SOURCE'
    | 'INACTIVE_SOURCE'
    | 'SOURCE_UNRESOLVED'
    | 'SOURCE_EMPTY' = 'SOURCE_EMPTY';
  let matchedSource: CloudbedsSource | null = null;

  if (isPastReservation) {
    const defaultMatch = findSourceMatch(sources, sourceDefaults.pastSourceName);
    matchedSource = defaultMatch.source;
    if (defaultMatch.source) {
      chosenSourceName = defaultMatch.source.sourceName;
      chosenSourceID = defaultMatch.source.sourceID;
      strategyUsed = `default-past:${defaultMatch.strategy}`;
    }
    sourceDecisionReason = 'PAST_CONFIGURED_OLD_SOURCE_APPLIED';
  } else {
    if (rawSourceCode) {
      debug('Migration', 'normalize', `Row ${rowIndex}: source "${rawSourceCode}" → key "${normalizedSourceKey}"`, {
        raw: rawSourceCode, key: normalizedSourceKey,
      });
      const match = findSourceMatch(sources, rawSourceCode);
      matchedSource = match.source;
      if (match.source) {
        chosenSourceName = match.source.sourceName;
        strategyUsed = match.strategy;
      }
      const futureDecision = evaluateFutureSourceDecision(match.source, rawSourceCode);
      sourceDecisionReason = futureDecision.reason;
      if (futureDecision.includeSource && futureDecision.sourceID) {
        chosenSourceID = futureDecision.sourceID;
      }
    } else {
      sourceDecisionReason = 'SOURCE_EMPTY';
    }
  }

  debug('Migration', 'resolve', `Row ${rowIndex}: source resolution → strategy=${strategyUsed}, name="${chosenSourceName ?? '(none)'}", id=${chosenSourceID ?? '(none)'}`, {
    rawSource: rawSourceCode || '(blank)',
    normalizedSource: normalizedSourceKey,
    arrival,
    bucket,
    configuredOldReservationsSource: sourceDefaults.pastSourceName,
    strategy: strategyUsed,
    chosenSourceName,
    chosenSourceID,
    sourceDecisionReason,
    matchedSourceSummary: matchedSource
      ? {
        sourceID: matchedSource.sourceID,
        sourceName: matchedSource.sourceName,
        isThirdParty: matchedSource.isThirdParty,
        status: matchedSource.status,
      }
      : null,
    availableSources: sources.map((s) => s.sourceName).slice(0, 10),
  });

  if (chosenSourceID) {
    payload.sourceID = chosenSourceID;
  } else {
    warn('Migration', 'resolve', `Row ${rowIndex}: source omitted (${sourceDecisionReason})`, {
      rowIndex,
      bucket,
      rawSource: rawSourceCode || '(blank)',
      normalizedSource: normalizedSourceKey,
      matchedSourceSummary: matchedSource
        ? {
          sourceID: matchedSource.sourceID,
          sourceName: matchedSource.sourceName,
          isThirdParty: matchedSource.isThirdParty,
          status: matchedSource.status,
        }
        : null,
      reason: sourceDecisionReason,
    });
  }

  // Optional: 3rd party code
  const thirdPartyCode = get('3rd Party Code');
  if (thirdPartyCode) {
    payload.thirdPartyIdentifier = thirdPartyCode;
  }

  // Gender — always normalized to M / F / N/A; never raw Excel text
  const rawGender = get('Gender');
  const normalizedGender = normalizeGender(rawGender);
  debug('Migration', 'normalize', `Row ${rowIndex}: gender "${rawGender}" → "${normalizedGender}"`, {
    raw: rawGender, normalized: normalizedGender,
  });
  payload.guestGender = normalizedGender;

  // guestZip is intentionally omitted from every payload — the API treats
  // missing zip as "unknown" and we never want to back-fill it during
  // migration. Any value in the Excel "Zip" column is ignored on purpose.

  // Optional: mobile
  const mobile = get('Mobile');
  if (mobile) payload.guestPhone = mobile;

  // Optional: requirements / special requests
  const requirements = get('Requirements');
  if (requirements) {
    debug('Migration', 'payload', `Row ${rowIndex}: requirements captured but omitted from payload`, {
      requirements,
    });
  }

  // Optional: ETA
  const eta = get('ETA');
  if (eta) payload.estimatedArrivalTime = eta;

  // Rate was resolved earlier (roomRateID is embedded inside the rooms array).

  // Optional: custom field
  const customField = get('Custom Field');
  if (customField) payload.customField = customField;

  // Optional: promo code
  const promoCode = get('Promo Code');
  if (promoCode) payload.promoCode = promoCode;

  // Optional: allotment code
  const allotmentCode = get('Allotment Code');
  if (allotmentCode) payload.allotmentBlockCode = allotmentCode;

  // Optional: group code
  const groupCode = get('Group Code');
  if (groupCode) payload.groupCode = groupCode;

  // Optional: creation date
  const creationDate = get('Creation Date');
  if (creationDate) payload.dateCreated = creationDate;

  debug('Migration', 'payload', `Row ${rowIndex}: payload built`, {
    rowIndex,
    startDate: payload.startDate,
    endDate: payload.endDate,
    guest: `${payload.guestFirstName} ${payload.guestLastName}`,
    rooms: payload.rooms,
    adults: payload.adults,
    children: payload.children,
    fieldCount: Object.keys(payload).length,
  });

  // Consolidated per-row summary containing every raw → normalized value and
  // the resolved IDs. This is the single entry to inspect when investigating
  // a specific row.
  info('Migration', 'row-summary', `Row ${rowIndex}: summary`, {
    rowIndex,
    bucket,
    roomType: {
      raw: roomTypeCode,
      resolvedRoomTypeID: roomTypeID,
    },
    source: {
      raw: rawSourceCode || '(blank)',
      normalized: normalizedSourceKey,
      chosenName: chosenSourceName,
      chosenID: chosenSourceID,
      includeSource: !!chosenSourceID,
      reason: sourceDecisionReason,
      matchedSource: matchedSource
        ? {
          sourceID: matchedSource.sourceID,
          sourceName: matchedSource.sourceName,
          isThirdParty: matchedSource.isThirdParty,
          status: matchedSource.status,
        }
        : null,
      strategy: strategyUsed,
    },
    rate: {
      raw: rawRateCode || '(blank)',
      normalized: normalizedRateKey,
      chosenName: chosenRateName,
      resolvedRoomRateID: chosenRoomRateID,
      usedDefault: usedDefaultRate,
      strategy: rateStrategy,
    },
    gender: {
      raw: rawGender,
      normalized: normalizedGender,
    },
    country: {
      raw: country,
      normalized: countryResult.iso2,
      resolved: countryResult.resolved,
    },
    payment: {
      raw: rawPaymentMethod,
      normalized: paymentMethod,
    },
    email: {
      raw: rawEmail,
      normalized: normalizedEmail || '(blank)',
      final: finalEmail,
      usedFallback: normalizedEmail === '',
    },
    payloadSummary: {
      startDate: payload.startDate,
      endDate: payload.endDate,
      guestCountry: payload.guestCountry,
      guestGender: payload.guestGender,
      guestEmail: payload.guestEmail,
      paymentMethod: payload.paymentMethod,
      sendEmailConfirmation: payload.sendEmailConfirmation,
      sourceID: payload.sourceID ?? '(omitted)',
      rooms: payload.rooms,
      adults: payload.adults,
      children: payload.children,
      fieldCount: Object.keys(payload).length,
    },
  });

  return { payload, error: null, normalizedEmail, finalEmail };
}

// ---------------------------------------------------------------------------
// Run migration sequentially
// ---------------------------------------------------------------------------

export async function migrateReservations(
  file: File,
  onProgress: (progress: MigrationProgress) => void,
  cancellation?: MigrationCancellation,
  validationResult?: ValidationResult | null,
): Promise<MigrationProgress> {
  info('Migration', 'start', `Starting reservation migration from ${file.name}`);

  // Load config
  const config = loadApiConfig();
  if (!config) {
    const msg = 'API configuration not saved. Please configure and test the API connection first.';
    logError('Migration', 'config', msg);
    return { total: 0, completed: 0, succeeded: 0, failed: 0, rows: [] };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const postUrl = `${mainApiUrl.replace(/\/+$/, '')}/postReservation`;

  debug('Migration', 'config', 'API config loaded', {
    mainApiUrl, propertyId, postUrl,
  });

  // Load cached room types, sources, and rates for resolution
  const roomCache = loadRoomDataCache(propertyId);
  const roomTypes = roomCache?.roomTypes ?? [];
  const sourcesCache = loadSourcesCache(propertyId);
  const sources = sourcesCache ?? [];
  const sourceDefaults = loadSourceDefaults(propertyId);
  const ratesCache = loadRatesCache(propertyId);
  const rates = ratesCache ?? [];
  const rateDefaults = loadRateDefaults(propertyId);

  info('Migration', 'config', `Cached data: ${roomTypes.length} room types, ${sources.length} sources, ${rates.length} rate entries`, {
    roomTypeShortCodes: roomTypes.map((r) => r.roomTypeNameShort),
    sourceNames: sources.map((s) => s.sourceName),
    sourceDefaults,
    rateDefaults,
    ratePlanNames: [...new Set(rates.map((r) => r.ratePlanNamePublic))],
  });

  if (roomTypes.length === 0) {
    warn('Migration', 'config', 'No room types cached — room type resolution may fail');
  }
  if (sources.length === 0) {
    warn('Migration', 'config', 'No sources cached — source resolution may fail');
  }
  if (rates.length === 0) {
    warn('Migration', 'config', 'No rates cached — rate resolution may fail, roomRateID will be omitted');
  }

  // Parse file
  let rows: Record<string, string>[];
  try {
    rows = await parseReservationFile(file);
  } catch (err) {
    const msg = `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`;
    logError('Migration', 'parse', msg);
    return { total: 0, completed: 0, succeeded: 0, failed: 0, rows: [] };
  }

  info('Migration', 'parse', `Parsed ${rows.length} rows`);

  // Initialize progress
  const migrationRows: MigrationRow[] = rows.map((_, i) => ({
    rowNumber: i + 2, // +2: 1-indexed + header row
    status: 'pending' as RowStatus,
    message: '',
  }));

  const progress: MigrationProgress = {
    total: rows.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
    rows: migrationRows,
  };

  const emitProgress = () => {
    onProgress({ ...progress, rows: [...progress.rows] });
  };
  emitProgress();

  const validRowSet = validationResult ? new Set(validationResult.validRowNumbers) : null;

  // Process a single row: build the payload, send it, update mRow + counters.
  // This function is invoked from a worker pool and never throws.
  const processRow = async (rowIndex: number): Promise<void> => {
    const row = rows[rowIndex];
    const mRow = migrationRows[rowIndex];
    const normalizedEmail = normalizeEmail(row['Email *']);
    const finalEmail = normalizedEmail || `migration+${mRow.rowNumber}@example.com`;
    mRow.normalizedEmail = normalizedEmail;
    mRow.finalEmail = finalEmail;

    if (validRowSet && !validRowSet.has(mRow.rowNumber)) {
      const rowIssues = validationResult?.rowIssues?.[mRow.rowNumber] ?? ['Row failed validation'];
      mRow.status = 'skipped';
      mRow.message = rowIssues[0] ?? 'Row failed validation';
      mRow.errorCategory = 'VALIDATION_ERROR';
      mRow.failureStage = 'pre_api';
      mRow.failureDetails = rowIssues;
      progress.completed++;
      progress.failed++;
      warn('Migration', 'skip', `Row ${mRow.rowNumber} skipped due to validation`, {
        rowNumber: mRow.rowNumber,
        errorCategory: mRow.errorCategory,
        failureStage: mRow.failureStage,
        normalizedEmail: normalizedEmail || '(blank)',
        finalEmail,
        rowIssues,
      });
      return;
    }

    // Build payload
    const {
      payload,
      error: buildError,
      errorCategory: buildErrorCategory,
      normalizedEmail: cleanedEmail,
      finalEmail: payloadEmail,
    } = buildPayload(
      row,
      mRow.rowNumber,
      propertyId,
      roomTypes,
      sources,
      sourceDefaults,
      rates,
      rateDefaults,
    );
    mRow.normalizedEmail = cleanedEmail;
    mRow.finalEmail = payloadEmail;

    if (buildError || !payload) {
      mRow.status = 'skipped';
      mRow.message = buildError ?? 'Failed to build payload';
      mRow.errorCategory = buildErrorCategory ?? 'VALIDATION_ERROR';
      mRow.failureStage = 'pre_api';
      mRow.failureDetails = [mRow.message];
      progress.completed++;
      progress.failed++;
      warn('Migration', 'skip', `Row ${mRow.rowNumber} skipped: ${mRow.message}`, {
        rowNumber: mRow.rowNumber,
        errorCategory: mRow.errorCategory,
        failureStage: mRow.failureStage,
        normalizedEmail: cleanedEmail || '(blank)',
        finalEmail: payloadEmail,
      });
      return;
    }

    mRow.payload = payload;
    mRow.status = 'sending';
    emitProgress();

    try {
      debug('Migration', 'send', `Sending row ${mRow.rowNumber}`, {
        url: postUrl,
        payload: { ...payload, propertyID: '***' },
      });

      const result = await window.electronAPI.apiPost({ url: postUrl, apiKey, body: payload });

      debug('Migration', 'response', `Row ${mRow.rowNumber}: HTTP ${result.status}`, {
        ok: result.ok, status: result.status,
        data: result.data,
        rawText: result.rawText,
        error: result.error,
      });

      if (result.ok) {
        const respData = result.data as { success?: boolean; data?: { reservationID?: string }; message?: string } | null;
        if (respData?.success) {
          mRow.status = 'success';
          mRow.reservationId = String(respData.data?.reservationID ?? '');
          mRow.message = mRow.reservationId
            ? `Created reservation ${mRow.reservationId}`
            : 'Reservation created';
          progress.succeeded++;
          info('Migration', 'success', `Row ${mRow.rowNumber}: ${mRow.message}`);
        } else {
          const parsedError = parseApiFailure(result.status, result.data, result.error, result.rawText);
          mRow.status = 'failed';
          mRow.message = parsedError.reason;
          mRow.errorCategory = parsedError.category;
          mRow.failureStage = 'post_api';
          mRow.failureDetails = [parsedError.responseSummary, ...parsedError.details];
          progress.failed++;
          warn('Migration', 'api-error', `Row ${mRow.rowNumber}: ${mRow.message}`, {
            rowNumber: mRow.rowNumber,
            errorCategory: mRow.errorCategory,
            failureStage: mRow.failureStage,
            normalizedEmail: cleanedEmail || '(blank)',
            finalEmail: payloadEmail,
            parsedError,
            response: respData,
          });
          if (!respData?.message) {
            debug('Migration', 'api-error-raw', `Row ${mRow.rowNumber}: raw API failure response`, {
              status: result.status,
              rawText: result.rawText,
              data: result.data,
            });
          }
        }
      } else {
        const parsedError = parseApiFailure(result.status, result.data, result.error, result.rawText);
        mRow.status = 'failed';
        mRow.message = parsedError.reason;
        mRow.errorCategory = parsedError.category;
        mRow.failureStage = 'post_api';
        mRow.failureDetails = [parsedError.responseSummary, ...parsedError.details];
        progress.failed++;
        warn('Migration', 'http-error', `Row ${mRow.rowNumber}: ${mRow.message}`, {
          rowNumber: mRow.rowNumber,
          status: result.status,
          errorCategory: mRow.errorCategory,
          failureStage: mRow.failureStage,
          normalizedEmail: cleanedEmail || '(blank)',
          finalEmail: payloadEmail,
          parsedError,
        });
        if (parsedError.reason === 'Unknown error — check payload or API response') {
          debug('Migration', 'api-error-raw', `Row ${mRow.rowNumber}: raw HTTP failure response`, {
            status: result.status,
            rawText: result.rawText,
            data: result.data,
            transportError: result.error,
          });
        }
      }
    } catch (err) {
      mRow.status = 'failed';
      mRow.message = err instanceof Error ? err.message : String(err);
      mRow.errorCategory = 'UNKNOWN_ERROR';
      mRow.failureStage = 'post_api';
      mRow.failureDetails = [mRow.message];
      progress.failed++;
      logError('Migration', 'exception', `Row ${mRow.rowNumber}: ${mRow.message}`, {
        rowNumber: mRow.rowNumber,
        errorCategory: mRow.errorCategory,
        failureStage: mRow.failureStage,
        normalizedEmail: cleanedEmail || '(blank)',
        finalEmail: payloadEmail,
      });
    }

    progress.completed++;
    emitProgress();
  };

  // Run a batch with bounded concurrency. Workers cooperatively pull row
  // indices from a shared cursor; if the user cancels mid-batch, workers stop
  // picking up new rows but already in-flight requests are allowed to settle.
  const runBatch = async (indices: number[]): Promise<void> => {
    let cursor = 0;
    const workerCount = Math.min(BATCH_CONCURRENCY, indices.length);
    const workers: Promise<void>[] = [];
    for (let w = 0; w < workerCount; w++) {
      workers.push((async () => {
        while (cursor < indices.length) {
          if (cancellation?.cancelled) return;
          const next = cursor++;
          await processRow(indices[next]);
        }
      })());
    }
    await Promise.all(workers);
  };

  // Walk the rows in sequential batches. Cancellation is checked between
  // batches and inside each worker.
  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    if (cancellation?.cancelled) {
      progress.stopped = true;
      info('Migration', 'cancel', `Migration stopped by user before row ${migrationRows[batchStart]?.rowNumber ?? batchStart + 2}`, {
        completed: progress.completed,
        total: progress.total,
      });
      break;
    }
    const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
    const batchIndices: number[] = [];
    for (let i = batchStart; i < batchEnd; i++) batchIndices.push(i);

    debug('Migration', 'batch', `Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: rows ${batchIndices[0] + 2}–${batchIndices[batchIndices.length - 1] + 2} (concurrency ${BATCH_CONCURRENCY})`, {
      batchSize: batchIndices.length,
      concurrency: BATCH_CONCURRENCY,
      completedSoFar: progress.completed,
      total: progress.total,
    });

    await runBatch(batchIndices);
    emitProgress();

    if (cancellation?.cancelled) {
      progress.stopped = true;
      info('Migration', 'cancel', `Migration stopped by user after batch ending at row ${migrationRows[batchEnd - 1]?.rowNumber ?? batchEnd + 1}`, {
        completed: progress.completed,
        total: progress.total,
      });
      break;
    }
  }

  // Final summary log — always emitted, even when 0 rows were processed.
  // Displayed at the top of the Migration tab (newest-first ordering).
  const failedRows = migrationRows
    .filter((r) => r.status === 'failed' || r.status === 'skipped')
    .map((r) => ({
      rowNumber: r.rowNumber,
      status: r.status,
      reason: r.message,
      category: r.errorCategory ?? '(none)',
      stage: r.failureStage ?? '(none)',
    }));

  const summaryHeadline = progress.stopped
    ? `Migration STOPPED by user: ${progress.succeeded} succeeded, ${progress.failed} failed, ${progress.total - progress.completed} not processed (out of ${progress.total})`
    : `Migration summary: ${progress.succeeded} succeeded, ${progress.failed} failed out of ${progress.total}`;

  info(
    'Migration',
    'summary',
    summaryHeadline,
    {
      total: progress.total,
      completed: progress.completed,
      succeeded: progress.succeeded,
      failed: progress.failed,
      stopped: !!progress.stopped,
      notProcessed: progress.total - progress.completed,
      failedRowNumbers: failedRows.map((r) => r.rowNumber),
      failedRows,
    },
  );

  info('Migration', 'complete', summaryHeadline);
  emitProgress();
  return progress;
}
