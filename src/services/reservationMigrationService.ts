import * as XLSX from 'xlsx';
import { loadApiConfig, type ApiPostResult } from './apiConfigurationService';
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
import {
  normalizeGender,
  normalizeCountry,
  normalizeEmail,
  normalizePayment,
  normalizeSourceKey,
  normalizeRateKey,
  normalizeApiDate,
  normalizeApiDateTime,
  normalizeApiTime,
} from './normalizationHelpers';
import { getCurrentAppDateTime } from './appDateTimeService';
import { info, debug, warn, error as logError, type LogMeta } from './debugLogger';

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
  guestId?: string;
  guestEmail?: string;
  guestFirstName?: string;
  guestLastName?: string;
  startDate?: string;
  endDate?: string;
  dateCreated?: string;
  payload?: Record<string, string>; // The API payload sent
  responseBody?: unknown;
}

export interface MigrationProgress {
  jobId: string;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  rows: MigrationRow[];
  stopped?: boolean;           // True when the user pressed Stop
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
}

export interface ReservationMigrationContext {
  moduleScope: string;
  fileName: string;
  jobId: string;
  verboseLogging: boolean;
}

/**
 * Mutable cancellation handle. The UI flips `cancelled = true` when the user
 * presses Stop; the migration loop checks this between rows and between
 * batches and exits cleanly. Already-sent API requests are NOT aborted.
 */
export interface MigrationCancellation {
  cancelled: boolean;
}

const BATCH_SIZE = 50;
const ROW_SEND_DELAY_MS = 350;
const BATCH_DELAY_MS = 900;
const RATE_LIMIT_RETRY_BASE_MS = 1500;
const RATE_LIMIT_RETRY_MAX_ATTEMPTS = 4;

interface BuildPayloadResult {
  payload: Record<string, string> | null;
  error: string | null;
  errorCategory?: MigrationErrorCategory;
  normalizedEmail: string;
  finalEmail: string;
  guestEmail?: string;
  guestFirstName?: string;
  guestLastName?: string;
  startDate?: string;
  endDate?: string;
  dateCreated?: string;
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

const RATE_LIMIT_PATTERNS = [
  'rate limit',
  'too many requests',
  'api rate limit exceeded',
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitFailure(status: number, data: unknown, transportError?: string, rawText?: string): boolean {
  if (status === 429) return true;
  const joined = uniqueStrings([transportError, rawText, ...collectApiMessages(data)]).join(' | ').toLowerCase();
  return RATE_LIMIT_PATTERNS.some((pattern) => joined.includes(pattern));
}

function createLogMeta(context: ReservationMigrationContext, overrides?: Partial<LogMeta>): LogMeta {
  return {
    moduleScope: context.moduleScope,
    fileName: context.fileName,
    jobId: context.jobId,
    ...overrides,
  };
}

function maybeDebug(
  context: ReservationMigrationContext,
  step: string,
  message: string,
  payload?: unknown,
  overrides?: Partial<LogMeta>,
): void {
  if (!context.verboseLogging) return;
  debug('Migration', step, message, payload, createLogMeta(context, overrides));
}

function sanitizePayloadForLog(payload: Record<string, string>): Record<string, string> {
  return {
    ...payload,
    propertyID: '***',
  };
}

function readStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extractSuccessField(data: unknown, field: string): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const obj = data as Record<string, unknown>;
  const direct = readStringField(obj[field]);
  if (direct) return direct;

  const nestedData = obj.data;
  if (Array.isArray(nestedData)) {
    for (const item of nestedData) {
      const hit = extractSuccessField(item, field);
      if (hit) return hit;
    }
  }

  if (nestedData && typeof nestedData === 'object') {
    const hit = extractSuccessField(nestedData, field);
    if (hit) return hit;
  }

  return undefined;
}

function extractSuccessResult(data: unknown): {
  reservationId?: string;
  guestId?: string;
  guestEmail?: string;
  guestFirstName?: string;
  guestLastName?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  dateCreated?: string;
} {
  return {
    reservationId: extractSuccessField(data, 'reservationID'),
    guestId: extractSuccessField(data, 'guestID'),
    guestEmail: extractSuccessField(data, 'guestEmail'),
    guestFirstName: extractSuccessField(data, 'guestFirstName'),
    guestLastName: extractSuccessField(data, 'guestLastName'),
    status: extractSuccessField(data, 'status'),
    startDate: extractSuccessField(data, 'startDate'),
    endDate: extractSuccessField(data, 'endDate'),
    dateCreated: extractSuccessField(data, 'dateCreated'),
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
  context: ReservationMigrationContext,
): BuildPayloadResult {
  const get = (header: string): string => (row[header] ?? '').trim();

  // Required fields
  const arrivalRaw = get('Arrival *');
  const departureRaw = get('Departure *');
  const firstName = get('First Name *');
  const lastName = get('Last Name *');
  const roomTypeCode = get('Room Type *');
  const country = get('Country *');
  const rawEmail = get('Email *');
  const normalizedEmail = normalizeEmail(rawEmail);
  const finalEmail = normalizedEmail || `migration+${rowIndex}@example.com`;
  const arrival = normalizeApiDate(arrivalRaw);
  const departure = normalizeApiDate(departureRaw);

  maybeDebug(context, 'date-normalization', `Row ${rowIndex}: normalized stay dates`, {
    arrivalRaw: arrivalRaw || '(empty)',
    arrivalNormalized: arrival ?? '(invalid)',
    departureRaw: departureRaw || '(empty)',
    departureNormalized: departure ?? '(invalid)',
  }, { rowNumber: rowIndex, logKind: 'normalization' });

  if (!arrivalRaw || !departureRaw || !firstName || !lastName || !roomTypeCode || !country) {
    maybeDebug(context, 'payload', `Row ${rowIndex}: missing required fields`, {
      arrival: arrivalRaw || '(empty)', departure: departureRaw || '(empty)',
      firstName: firstName || '(empty)', lastName: lastName || '(empty)',
      roomTypeCode: roomTypeCode || '(empty)', country: country || '(empty)',
    }, { rowNumber: rowIndex, logKind: 'validation' });
    return {
      payload: null,
      error: 'Missing required fields',
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
    };
  }

  if (!arrival) {
    return {
      payload: null,
      error: `Arrival "${arrivalRaw}" could not be normalized`,
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
    };
  }

  if (!departure) {
    return {
      payload: null,
      error: `Departure "${departureRaw}" could not be normalized`,
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
    };
  }

  if (departure <= arrival) {
    return {
      payload: null,
      error: 'Departure must be later than Arrival',
      errorCategory: 'VALIDATION_ERROR',
      normalizedEmail,
      finalEmail,
      startDate: arrival,
      endDate: departure,
    };
  }

  // Resolve room type
  const roomTypeID = resolveRoomTypeId(roomTypes, roomTypeCode);
  maybeDebug(context, 'resolve', `Row ${rowIndex}: room type "${roomTypeCode}" -> ${roomTypeID || '(not found)'}`, {
    roomTypeCode, roomTypeID, availableTypes: roomTypes.map((r) => r.roomTypeNameShort).slice(0, 10),
  }, { rowNumber: rowIndex, logKind: 'resolution' });
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
    maybeDebug(context, 'normalize', `Row ${rowIndex}: email "${rawEmail}" -> "${normalizedEmail || '(blank)'}"`, {
      raw: rawEmail,
      normalized: normalizedEmail || '(blank)',
      final: finalEmail,
      usedFallback: normalizedEmail === '',
      emailContainsNonAscii,
    }, { rowNumber: rowIndex, logKind: 'normalization' });
  }

  // Normalize payment method (credit / ebanking / cash)
  const rawPaymentMethod = get('Payment Method *');
  const paymentMethod = normalizePayment(rawPaymentMethod);
  maybeDebug(context, 'normalize', `Row ${rowIndex}: payment "${rawPaymentMethod}" -> "${paymentMethod}"`, {
    raw: rawPaymentMethod, normalized: paymentMethod,
  }, { rowNumber: rowIndex, logKind: 'normalization' });

  // Normalize country to ISO2 (always populated; falls back to TR)
  const countryResult = normalizeCountry(country);
  maybeDebug(context, 'normalize', `Row ${rowIndex}: country "${country}" -> "${countryResult.iso2}"${countryResult.resolved ? '' : ' (fallback)'}`, {
    raw: country, normalized: countryResult.iso2, resolved: countryResult.resolved,
  }, { rowNumber: rowIndex, logKind: 'normalization' });
  if (!countryResult.resolved) {
    warn(
      'Migration',
      'normalize',
      `Row ${rowIndex}: country "${country}" not recognized - falling back to TR`,
      { rowIndex, raw: country },
      createLogMeta(context, { rowNumber: rowIndex, logKind: 'normalization' }),
    );
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
    maybeDebug(context, 'normalize', `Row ${rowIndex}: rate "${rawRateCode}" -> key "${normalizedRateKey}"`, {
      raw: rawRateCode, key: normalizedRateKey,
    }, { rowNumber: rowIndex, logKind: 'normalization' });
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

  maybeDebug(context, 'resolve', `Row ${rowIndex}: rate resolution -> strategy=${rateStrategy}, name="${chosenRateName ?? '(none)'}", roomRateID=${chosenRoomRateID ?? '(none)'}`, {
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
  }, { rowNumber: rowIndex, logKind: 'resolution' });

  if (!chosenRoomRateID) {
    warn('Migration', 'resolve', `Row ${rowIndex}: no rate resolvable for room type ${roomTypeID} (raw="${rawRateCode}", default="${defaultRateName}")`, {
      rowIndex,
      rawRate: rawRateCode,
      normalizedRate: normalizedRateKey,
      roomTypeID,
      defaultRateName,
      bucket,
    }, createLogMeta(context, { rowNumber: rowIndex, logKind: 'resolution' }));
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
      maybeDebug(context, 'normalize', `Row ${rowIndex}: source "${rawSourceCode}" -> key "${normalizedSourceKey}"`, {
        raw: rawSourceCode, key: normalizedSourceKey,
      }, { rowNumber: rowIndex, logKind: 'normalization' });
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

  maybeDebug(context, 'resolve', `Row ${rowIndex}: source resolution -> strategy=${strategyUsed}, name="${chosenSourceName ?? '(none)'}", id=${chosenSourceID ?? '(none)'}`, {
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
  }, { rowNumber: rowIndex, logKind: 'resolution' });

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
    }, createLogMeta(context, { rowNumber: rowIndex, logKind: 'resolution' }));
  }

  // Optional: 3rd party code
  const thirdPartyCode = get('3rd Party Code');
  if (thirdPartyCode) {
    payload.thirdPartyIdentifier = thirdPartyCode;
  }

  // Gender — always normalized to M / F / N/A; never raw Excel text
  const rawGender = get('Gender');
  const normalizedGender = normalizeGender(rawGender);
  maybeDebug(context, 'normalize', `Row ${rowIndex}: gender "${rawGender}" -> "${normalizedGender}"`, {
    raw: rawGender, normalized: normalizedGender,
  }, { rowNumber: rowIndex, logKind: 'normalization' });
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
    maybeDebug(context, 'payload', `Row ${rowIndex}: requirements captured but omitted from payload`, {
      requirements,
    }, { rowNumber: rowIndex, logKind: 'payload' });
  }

  // Optional: ETA
  const eta = get('ETA');
  if (eta) {
    const normalizedEta = normalizeApiTime(eta);
    info('Migration', 'date-normalization', `Row ${rowIndex}: ETA normalized`, {
      raw: eta,
      normalized: normalizedEta ?? '(invalid)',
    }, createLogMeta(context, { rowNumber: rowIndex, logKind: 'normalization' }));
    if (normalizedEta) {
      payload.estimatedArrivalTime = normalizedEta;
    }
  }

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
  const creationDateRaw = get('Creation Date');
  const creationDate = creationDateRaw ? normalizeApiDateTime(creationDateRaw) : null;
  if (creationDateRaw) {
    maybeDebug(context, 'date-normalization', `Row ${rowIndex}: creation date normalized`, {
      raw: creationDateRaw,
      normalized: creationDate ?? '(invalid)',
    }, { rowNumber: rowIndex, logKind: 'normalization' });
    if (creationDate) {
      payload.dateCreated = creationDate;
    }
  }

  maybeDebug(context, 'payload', `Row ${rowIndex}: payload built`, {
    rowIndex,
    startDate: payload.startDate,
    endDate: payload.endDate,
    guest: `${payload.guestFirstName} ${payload.guestLastName}`,
    rooms: payload.rooms,
    adults: payload.adults,
    children: payload.children,
    fieldCount: Object.keys(payload).length,
  }, { rowNumber: rowIndex, logKind: 'payload' });

  // Consolidated per-row summary containing every raw → normalized value and
  // the resolved IDs. This is the single entry to inspect when investigating
  // a specific row.
  if (context.verboseLogging) {
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
    }, createLogMeta(context, { rowNumber: rowIndex, logKind: 'payload' }));
  }

  return {
    payload,
    error: null,
    normalizedEmail,
    finalEmail,
    guestEmail: payload.guestEmail,
    guestFirstName: payload.guestFirstName,
    guestLastName: payload.guestLastName,
    startDate: payload.startDate,
    endDate: payload.endDate,
    dateCreated: payload.dateCreated,
  };
}

// ---------------------------------------------------------------------------
// Run migration sequentially
// ---------------------------------------------------------------------------

export async function migrateReservations(
  file: File,
  onProgress: (progress: MigrationProgress) => void,
  options?: {
    cancellation?: MigrationCancellation;
    validationResult?: ValidationResult | null;
    context?: ReservationMigrationContext;
  },
): Promise<MigrationProgress> {
  const context = options?.context ?? {
    moduleScope: 'Reservation',
    fileName: file.name,
    jobId: `reservation-${Date.now()}`,
    verboseLogging: true,
  };
  const cancellation = options?.cancellation;
  const validationResult = options?.validationResult;
  const startedAt = new Date();

  info(
    'Migration',
    'start',
    `Starting reservation migration from ${file.name}`,
    undefined,
    createLogMeta(context, { logKind: 'migration' }),
  );

  // Load config
  const config = loadApiConfig();
  if (!config) {
    const msg = 'API configuration not saved. Please configure and test the API connection first.';
    logError('Migration', 'config', msg, undefined, createLogMeta(context, { logKind: 'migration' }));
    return {
      jobId: context.jobId,
      total: 0,
      completed: 0,
      succeeded: 0,
      failed: 0,
      rows: [],
      startedAt: startedAt.toISOString(),
    };
  }

  const { mainApiUrl, apiKey, propertyId } = config;
  const postUrl = `${mainApiUrl.replace(/\/+$/, '')}/postReservation`;

  maybeDebug(context, 'config', 'API config loaded', {
    mainApiUrl, propertyId, postUrl,
  }, { logKind: 'migration' });

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
  }, createLogMeta(context, { logKind: 'migration' }));

  if (roomTypes.length === 0) {
    warn('Migration', 'config', 'No room types cached - room type resolution may fail', undefined, createLogMeta(context, { logKind: 'migration' }));
  }
  if (sources.length === 0) {
    warn('Migration', 'config', 'No sources cached - source resolution may fail', undefined, createLogMeta(context, { logKind: 'migration' }));
  }
  if (rates.length === 0) {
    warn('Migration', 'config', 'No rates cached - rate resolution may fail, roomRateID will be omitted', undefined, createLogMeta(context, { logKind: 'migration' }));
  }

  // Parse file
  let rows: Record<string, string>[];
  try {
    rows = await parseReservationFile(file);
  } catch (err) {
    const msg = `Failed to parse file: ${err instanceof Error ? err.message : String(err)}`;
    logError('Migration', 'parse', msg, undefined, createLogMeta(context, { logKind: 'migration' }));
    return { jobId: context.jobId, total: 0, completed: 0, succeeded: 0, failed: 0, rows: [], startedAt: startedAt.toISOString() };
  }

  info('Migration', 'parse', `Parsed ${rows.length} rows`, { count: rows.length }, createLogMeta(context, { logKind: 'migration' }));

  // Initialize progress
  const migrationRows: MigrationRow[] = rows.map((_, i) => ({
    rowNumber: i + 2, // +2: 1-indexed + header row
    status: 'pending' as RowStatus,
    message: '',
  }));

  const progress: MigrationProgress = {
    jobId: context.jobId,
    total: rows.length,
    completed: 0,
    succeeded: 0,
    failed: 0,
    rows: migrationRows,
    startedAt: startedAt.toISOString(),
  };

  const emitProgress = () => {
    progress.durationMs = Date.now() - startedAt.getTime();
    onProgress({ ...progress, rows: [...progress.rows] });
  };
  emitProgress();

  const postReservationWithRetry = async (
    payload: Record<string, string>,
    rowNumber: number,
  ): Promise<ApiPostResult> => {
    let attempt = 0;
    while (true) {
      const result = await window.electronAPI.apiPost({ url: postUrl, apiKey, body: payload });
      if (!isRateLimitFailure(result.status, result.data, result.error, result.rawText)) {
        return result;
      }

      attempt += 1;
      if (attempt > RATE_LIMIT_RETRY_MAX_ATTEMPTS || cancellation?.cancelled) {
        return result;
      }

      const backoffMs = RATE_LIMIT_RETRY_BASE_MS * (2 ** (attempt - 1));
      warn(
        'Migration',
        'rate-limit',
        `Row ${rowNumber}: rate limit hit, retrying in ${backoffMs}ms (attempt ${attempt}/${RATE_LIMIT_RETRY_MAX_ATTEMPTS})`,
        {
          rowNumber,
          attempt,
          backoffMs,
          status: result.status,
          error: result.error,
          rawText: result.rawText,
        },
        createLogMeta(context, { rowNumber, logKind: 'execution_summary' }),
      );
      await delay(backoffMs);
    }
  };

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
      }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'invalid_row' }));
      return;
    }

    // Build payload
    const {
      payload,
      error: buildError,
      errorCategory: buildErrorCategory,
      normalizedEmail: cleanedEmail,
      finalEmail: payloadEmail,
      guestEmail,
      guestFirstName,
      guestLastName,
      startDate,
      endDate,
      dateCreated,
    } = buildPayload(
      row,
      mRow.rowNumber,
      propertyId,
      roomTypes,
      sources,
      sourceDefaults,
      rates,
      rateDefaults,
      context,
    );
    mRow.normalizedEmail = cleanedEmail;
    mRow.finalEmail = payloadEmail;
    mRow.guestEmail = guestEmail ?? payloadEmail;
    mRow.guestFirstName = guestFirstName;
    mRow.guestLastName = guestLastName;
    mRow.startDate = startDate;
    mRow.endDate = endDate;
    mRow.dateCreated = dateCreated;

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
      }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'invalid_row' }));
      return;
    }

    mRow.payload = payload;
    mRow.status = 'sending';
    emitProgress();

    try {
      maybeDebug(context, 'send', `Sending row ${mRow.rowNumber}`, {
        url: postUrl,
        payload: sanitizePayloadForLog(payload),
      }, { rowNumber: mRow.rowNumber, logKind: 'payload' });

      const result = await postReservationWithRetry(payload, mRow.rowNumber);

      mRow.responseBody = result.data ?? result.rawText ?? result.error ?? null;
      maybeDebug(context, 'response', `Row ${mRow.rowNumber}: HTTP ${result.status}`, {
        ok: result.ok, status: result.status,
        data: result.data,
        rawText: result.rawText,
        error: result.error,
      }, { rowNumber: mRow.rowNumber, logKind: 'api_response' });

      if (result.ok) {
        const respData = result.data as { success?: boolean; data?: unknown; message?: string } | null;
        if (respData?.success) {
          const successResult = extractSuccessResult(result.data);
          mRow.status = 'success';
          mRow.reservationId = successResult.reservationId ?? '';
          mRow.guestId = successResult.guestId;
          mRow.guestEmail = successResult.guestEmail ?? mRow.guestEmail ?? payloadEmail;
          mRow.guestFirstName = successResult.guestFirstName ?? mRow.guestFirstName;
          mRow.guestLastName = successResult.guestLastName ?? mRow.guestLastName;
          mRow.startDate = successResult.startDate ?? mRow.startDate;
          mRow.endDate = successResult.endDate ?? mRow.endDate;
          mRow.dateCreated = successResult.dateCreated ?? mRow.dateCreated;
          mRow.message = mRow.reservationId
            ? `Created reservation ${mRow.reservationId}`
            : 'Reservation created';
          progress.succeeded++;
          if (context.verboseLogging) {
            info('Migration', 'success', `Row ${mRow.rowNumber}: ${mRow.message}`, {
              reservationId: mRow.reservationId,
              guestId: mRow.guestId,
              guestEmail: mRow.guestEmail,
            }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'row_success' }));
          }
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
          }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'invalid_row' }));
          if (!respData?.message) {
            maybeDebug(context, 'api-error-raw', `Row ${mRow.rowNumber}: raw API failure response`, {
              status: result.status,
              rawText: result.rawText,
              data: result.data,
            }, { rowNumber: mRow.rowNumber, logKind: 'api_response' });
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
        }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'invalid_row' }));
        if (parsedError.reason === 'Unknown error — check payload or API response') {
          maybeDebug(context, 'api-error-raw', `Row ${mRow.rowNumber}: raw HTTP failure response`, {
            status: result.status,
            rawText: result.rawText,
            data: result.data,
            transportError: result.error,
          }, { rowNumber: mRow.rowNumber, logKind: 'api_response' });
        }
      }
    } catch (err) {
      mRow.status = 'failed';
      mRow.message = err instanceof Error ? err.message : String(err);
      mRow.errorCategory = 'UNKNOWN_ERROR';
      mRow.failureStage = 'post_api';
      mRow.failureDetails = [mRow.message];
      mRow.responseBody = err instanceof Error ? { message: err.message, stack: err.stack } : String(err);
      progress.failed++;
      logError('Migration', 'exception', `Row ${mRow.rowNumber}: ${mRow.message}`, {
        rowNumber: mRow.rowNumber,
        errorCategory: mRow.errorCategory,
        failureStage: mRow.failureStage,
        normalizedEmail: cleanedEmail || '(blank)',
        finalEmail: payloadEmail,
      }, createLogMeta(context, { rowNumber: mRow.rowNumber, logKind: 'invalid_row' }));
    }

    progress.completed++;
    emitProgress();
  };

  // Run a batch sequentially so reservation requests are safely throttled and
  // never sent in parallel.
  const runBatch = async (indices: number[]): Promise<void> => {
    for (let index = 0; index < indices.length; index++) {
      if (cancellation?.cancelled) return;
      await processRow(indices[index]);
      if (index < indices.length - 1) {
        await delay(ROW_SEND_DELAY_MS);
      }
    }
  };

  // Walk the rows in sequential batches. Cancellation is checked between
  // batches and inside each row send.
  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    if (cancellation?.cancelled) {
      progress.stopped = true;
      info('Migration', 'cancel', `Migration stopped by user before row ${migrationRows[batchStart]?.rowNumber ?? batchStart + 2}`, {
        completed: progress.completed,
        total: progress.total,
      }, createLogMeta(context, { logKind: 'execution_summary' }));
      break;
    }
    const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
    const batchIndices: number[] = [];
    for (let i = batchStart; i < batchEnd; i++) batchIndices.push(i);

    info('Migration', 'batch', `Processing batch ${Math.floor(batchStart / BATCH_SIZE) + 1}: rows ${batchIndices[0] + 2}-${batchIndices[batchIndices.length - 1] + 2}`, {
      batchSize: batchIndices.length,
      concurrency: 1,
      completedSoFar: progress.completed,
      total: progress.total,
    }, createLogMeta(context, { logKind: 'execution_summary' }));

    await runBatch(batchIndices);
    emitProgress();

    if (!cancellation?.cancelled && batchEnd < rows.length) {
      await delay(BATCH_DELAY_MS);
    }

    if (cancellation?.cancelled) {
      progress.stopped = true;
      info('Migration', 'cancel', `Migration stopped by user after batch ending at row ${migrationRows[batchEnd - 1]?.rowNumber ?? batchEnd + 1}`, {
        completed: progress.completed,
        total: progress.total,
      }, createLogMeta(context, { logKind: 'execution_summary' }));
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
    createLogMeta(context, { logKind: 'execution_summary' }),
  );

  progress.endedAt = new Date().toISOString();
  progress.durationMs = Date.now() - startedAt.getTime();
  info('Migration', 'complete', summaryHeadline, undefined, createLogMeta(context, { logKind: 'execution_summary' }));
  emitProgress();
  return progress;
}
