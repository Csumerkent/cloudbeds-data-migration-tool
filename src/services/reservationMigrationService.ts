import * as XLSX from 'xlsx';
import { loadApiConfig } from './apiConfigurationService';
import { loadRoomDataCache, resolveRoomTypeId, CloudbedsRoomType } from './roomConfigurationService';
import { loadSourcesCache, resolveSourceId, CloudbedsSource } from './sourceConfigurationService';
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
  const paymentMethod = get('Payment Method *') || 'cash';
  const emailConfirmation = get('Email Confirmation') || 'false';

  // Build rooms/adults/children as JSON arrays (API requires array format)
  const roomsArray = JSON.stringify([{ quantity: Number(roomCount) || 1, roomTypeID }]);
  const adultsArray = JSON.stringify([{ quantity: Number(adult) || 1, roomTypeID }]);
  const childrenArray = JSON.stringify([{ quantity: Number(child) || 0, roomTypeID }]);

  // Build base payload
  const payload: Record<string, string> = {
    propertyID: propertyId,
    startDate: arrival,
    endDate: departure,
    guestFirstName: firstName,
    guestLastName: lastName,
    guestEmail: email,
    guestCountry: country.toUpperCase(),
    rooms: roomsArray,
    adults: adultsArray,
    children: childrenArray,
    paymentMethod,
    sendEmailConfirmation: emailConfirmation === 'true' ? '1' : '0',
  };

  // Optional: source
  const sourceCode = get('Source Code');
  if (sourceCode) {
    const sourceID = resolveSourceId(sources, sourceCode);
    debug('Migration', 'resolve', `Row ${rowIndex}: source "${sourceCode}" → ${sourceID || '(not found)'}`, {
      sourceCode, sourceID, availableSources: sources.map((s) => s.sourceName).slice(0, 10),
    });
    if (sourceID) {
      payload.sourceID = sourceID;
    } else {
      warn('Migration', 'resolve', `Row ${rowIndex}: source "${sourceCode}" not resolved — omitting`, { rowIndex, sourceCode });
    }
  }

  // Optional: 3rd party code
  const thirdPartyCode = get('3rd Party Code');
  if (thirdPartyCode) {
    payload.thirdPartyIdentifier = thirdPartyCode;
  }

  // Optional: gender
  const gender = get('Gender');
  if (gender) payload.guestGender = gender;

  // Optional: zip
  const zip = get('Zip');
  if (zip) payload.guestZip = zip;

  // Optional: mobile
  const mobile = get('Mobile');
  if (mobile) payload.guestPhone = mobile;

  // Optional: requirements / special requests
  const requirements = get('Requirements');
  if (requirements) payload.guestSpecialRequests = requirements;

  // Optional: ETA
  const eta = get('ETA');
  if (eta) payload.estimatedArrivalTime = eta;

  // Optional: rate code
  const rateCode = get('Rate Code');
  if (rateCode) payload.ratePlanNamePublic = rateCode;

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

  // Load cached room types and sources for resolution
  const roomCache = loadRoomDataCache(propertyId);
  const roomTypes = roomCache?.roomTypes ?? [];
  const sourcesCache = loadSourcesCache(propertyId);
  const sources = sourcesCache ?? [];

  info('Migration', 'config', `Cached data: ${roomTypes.length} room types, ${sources.length} sources`, {
    roomTypeShortCodes: roomTypes.map((r) => r.roomTypeNameShort),
    sourceNames: sources.map((s) => s.sourceName),
  });

  if (roomTypes.length === 0) {
    warn('Migration', 'config', 'No room types cached — room type resolution may fail');
  }
  if (sources.length === 0) {
    warn('Migration', 'config', 'No sources cached — source resolution may fail');
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
    const { payload, error: buildError } = buildPayload(row, mRow.rowNumber, propertyId, roomTypes, sources);

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
