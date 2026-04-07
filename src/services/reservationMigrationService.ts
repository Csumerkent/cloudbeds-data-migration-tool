import * as XLSX from 'xlsx';
import { loadApiConfig } from './apiConfigurationService';
import { loadRoomDataCache, resolveRoomTypeId, CloudbedsRoomType } from './roomConfigurationService';
import {
  loadSourcesCache,
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
import { normalizeGender, normalizeCountry, normalizePayment, normalizeSourceKey, normalizeRateKey } from './normalizationHelpers';
import { info, debug, warn, error as logError } from './debugLogger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RowStatus = 'pending' | 'sending' | 'success' | 'failed' | 'skipped';

export interface MigrationRow {
  rowNumber: number;           // Excel row (1-indexed, header = row 1)
  status: RowStatus;
  message: string;
  reservationId?: string;      // Returned by Cloudbeds on success
  payload?: Record<string, string>; // The API payload sent
}

export interface MigrationProgress {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  rows: MigrationRow[];
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
): { payload: Record<string, string> | null; error: string | null } {
  const get = (header: string): string => (row[header] ?? '').trim();

  // Required fields
  const arrival = get('Arrival *');
  const departure = get('Departure *');
  const firstName = get('First Name *');
  const lastName = get('Last Name *');
  const roomTypeCode = get('Room Type *');
  const country = get('Country *');

  if (!arrival || !departure || !firstName || !lastName || !roomTypeCode || !country) {
    debug('Migration', 'payload', `Row ${rowIndex}: missing required fields`, {
      arrival: arrival || '(empty)', departure: departure || '(empty)',
      firstName: firstName || '(empty)', lastName: lastName || '(empty)',
      roomTypeCode: roomTypeCode || '(empty)', country: country || '(empty)',
    });
    return { payload: null, error: 'Missing required fields' };
  }

  // Resolve room type
  const roomTypeID = resolveRoomTypeId(roomTypes, roomTypeCode);
  debug('Migration', 'resolve', `Row ${rowIndex}: room type "${roomTypeCode}" → ${roomTypeID || '(not found)'}`, {
    roomTypeCode, roomTypeID, availableTypes: roomTypes.map((r) => r.roomTypeNameShort).slice(0, 10),
  });
  if (!roomTypeID) {
    return { payload: null, error: `Room type "${roomTypeCode}" not found in Cloudbeds` };
  }

  // Apply defaults
  const email = get('Email *') || `migration+${rowIndex}@example.com`;
  const adult = get('Adult *') || '1';
  const child = get('Child') || '0';
  const roomCount = get('Room Count') || '1';

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
  const today = new Date();
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
  //  1. If Excel value is filled → exact / normalized / contains match.
  //  2. If still no match (or value is blank) → fall back to the configured
  //     past or future default depending on the arrival date.
  //  3. The default name is itself resolved through the same matcher so that
  //     "FORMERPMS" / "Direct - Hotel" find the closest entry in this property.
  const rawSourceCode = get('Source Code');
  const normalizedSourceKey = normalizeSourceKey(rawSourceCode);

  const defaultName = isPastReservation
    ? sourceDefaults.pastSourceName
    : sourceDefaults.futureSourceName;
  const defaultBucket = bucket;

  let chosenSourceName: string | null = null;
  let chosenSourceID: string | null = null;
  let strategyUsed: string = 'none';
  let usedDefault = false;

  if (rawSourceCode) {
    debug('Migration', 'normalize', `Row ${rowIndex}: source "${rawSourceCode}" → key "${normalizedSourceKey}"`, {
      raw: rawSourceCode, key: normalizedSourceKey,
    });
    const match = findSourceMatch(sources, rawSourceCode);
    if (match.source) {
      chosenSourceName = match.source.sourceName;
      chosenSourceID = match.source.sourceID;
      strategyUsed = match.strategy;
    }
  }

  if (!chosenSourceID) {
    // Fall back to the configured default for this row's bucket.
    const defaultMatch = findSourceMatch(sources, defaultName);
    if (defaultMatch.source) {
      chosenSourceName = defaultMatch.source.sourceName;
      chosenSourceID = defaultMatch.source.sourceID;
      strategyUsed = `default-${defaultBucket}:${defaultMatch.strategy}`;
      usedDefault = true;
    }
  }

  debug('Migration', 'resolve', `Row ${rowIndex}: source resolution → strategy=${strategyUsed}, name="${chosenSourceName ?? '(none)'}", id=${chosenSourceID ?? '(none)'}`, {
    rawSource: rawSourceCode || '(blank)',
    normalizedSource: normalizedSourceKey,
    arrival,
    bucket: defaultBucket,
    defaultName,
    usedDefault,
    strategy: strategyUsed,
    chosenSourceName,
    chosenSourceID,
    availableSources: sources.map((s) => s.sourceName).slice(0, 10),
  });

  if (chosenSourceID) {
    payload.sourceID = chosenSourceID;
  } else {
    warn('Migration', 'resolve', `Row ${rowIndex}: no source resolvable (raw="${rawSourceCode}", default="${defaultName}") — omitting`, {
      rowIndex,
      rawSource: rawSourceCode,
      normalizedSource: normalizedSourceKey,
      defaultName,
      bucket: defaultBucket,
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
  if (requirements) payload.guestSpecialRequests = requirements;

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

  return { payload, error: null };
}

// ---------------------------------------------------------------------------
// Run migration sequentially
// ---------------------------------------------------------------------------

export async function migrateReservations(
  file: File,
  onProgress: (progress: MigrationProgress) => void,
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

  onProgress({ ...progress, rows: [...progress.rows] });

  // Process each row sequentially
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const mRow = migrationRows[i];

    // Build payload
    const { payload, error: buildError } = buildPayload(row, mRow.rowNumber, propertyId, roomTypes, sources, sourceDefaults, rates, rateDefaults);

    if (buildError || !payload) {
      mRow.status = 'skipped';
      mRow.message = buildError ?? 'Failed to build payload';
      progress.completed++;
      progress.failed++;
      debug('Migration', 'skip', `Row ${mRow.rowNumber} skipped: ${mRow.message}`);
      onProgress({ ...progress, rows: [...progress.rows] });
      continue;
    }

    mRow.payload = payload;
    mRow.status = 'sending';
    onProgress({ ...progress, rows: [...progress.rows] });

    try {
      debug('Migration', 'send', `Sending row ${mRow.rowNumber}`, {
        url: postUrl,
        payload: { ...payload, propertyID: '***' },
      });

      const result = await window.electronAPI.apiPost({ url: postUrl, apiKey, body: payload });

      debug('Migration', 'response', `Row ${mRow.rowNumber}: HTTP ${result.status}`, {
        ok: result.ok, status: result.status,
        data: result.data,
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
          mRow.status = 'failed';
          mRow.message = respData?.message ?? `API returned success=false (HTTP ${result.status})`;
          progress.failed++;
          warn('Migration', 'api-error', `Row ${mRow.rowNumber}: ${mRow.message}`, { response: respData });
        }
      } else {
        mRow.status = 'failed';
        mRow.message = result.error ?? `HTTP ${result.status}`;
        progress.failed++;
        warn('Migration', 'http-error', `Row ${mRow.rowNumber}: ${mRow.message}`, { status: result.status });
      }
    } catch (err) {
      mRow.status = 'failed';
      mRow.message = err instanceof Error ? err.message : String(err);
      progress.failed++;
      logError('Migration', 'exception', `Row ${mRow.rowNumber}: ${mRow.message}`);
    }

    progress.completed++;
    onProgress({ ...progress, rows: [...progress.rows] });
  }

  info('Migration', 'complete', `Migration done: ${progress.succeeded} succeeded, ${progress.failed} failed out of ${progress.total}`);
  return progress;
}
