import * as XLSX from 'xlsx';
import { normalizeEmail } from './normalizationHelpers';
import { info, debug, warn, error as logError } from './debugLogger';

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

export interface ColumnDef {
  header: string;       // Display label (with * if required)
  key: string;          // Internal key for mapping
  required: boolean;
}

export const RESERVATION_COLUMNS: ColumnDef[] = [
  { header: 'Arrival *',          key: 'arrival',           required: true },
  { header: 'Departure *',        key: 'departure',         required: true },
  { header: 'First Name *',       key: 'firstName',         required: true },
  { header: 'Last Name *',        key: 'lastName',          required: true },
  { header: 'Room Count',         key: 'roomCount',         required: false },
  { header: 'Room Type *',        key: 'roomType',          required: true },
  { header: 'Adult *',            key: 'adult',             required: true },
  { header: 'Child',              key: 'child',             required: false },
  { header: 'Email *',            key: 'email',             required: true },
  { header: 'Country *',          key: 'country',           required: true },
  { header: 'Payment Method *',   key: 'paymentMethod',     required: true },
  { header: 'Source Code',        key: 'sourceCode',        required: false },
  { header: '3rd Party Code',     key: 'thirdPartyCode',    required: false },
  { header: 'Gender',             key: 'gender',            required: false },
  { header: 'Zip',                key: 'zip',               required: false },
  { header: 'Mobile',             key: 'mobile',            required: false },
  { header: 'Requirements',       key: 'requirements',      required: false },
  { header: 'ETA',                key: 'eta',               required: false },
  { header: 'Rate Code',          key: 'rateCode',          required: false },
  { header: 'Custom Field',       key: 'customField',       required: false },
  { header: 'Promo Code',         key: 'promoCode',         required: false },
  { header: 'Allotment Code',     key: 'allotmentCode',     required: false },
  { header: 'Group Code',         key: 'groupCode',         required: false },
  { header: 'Creation Date',      key: 'creationDate',      required: false },
  { header: 'Email Confirmation', key: 'emailConfirmation', required: false },
];

const REQUIRED_HEADERS = RESERVATION_COLUMNS.filter((c) => c.required).map((c) => c.header);

// ---------------------------------------------------------------------------
// Instruction sheet content
// ---------------------------------------------------------------------------

const INSTRUCTION_ROWS: string[][] = [
  ['CLOUDBEDS RESERVATION MIGRATION TEMPLATE'],
  ['Instructions & rules — please read before filling the Reservations sheet.'],
  [],
  ['================================================================'],
  ['  GENERAL RULES'],
  ['================================================================'],
  [],
  ['  •  Columns marked with " * " are REQUIRED.'],
  ['  •  Do NOT rename, reorder, or remove columns in the Reservations sheet.'],
  ['  •  Do NOT modify this Instructions sheet.'],
  ['  •  Only .xlsx files are supported.'],
  [],
  [],
  ['================================================================'],
  ['  DATE FORMAT'],
  ['================================================================'],
  [],
  ['  •  All dates must be in YYYY-MM-DD format.'],
  ['  •  Departure date must be later than Arrival date.'],
  [],
  ['     Examples:'],
  ['         2025-06-15      ✓ valid'],
  ['         15/06/2025      ✗ wrong format'],
  ['         2025-13-01      ✗ invalid month'],
  [],
  [],
  ['================================================================'],
  ['  ROOM TYPE'],
  ['================================================================'],
  [],
  ['  •  Enter the room type SHORT CODE (e.g. STD, DLX),'],
  ['     NOT the Cloudbeds numeric ID.'],
  ['  •  The application resolves the short code to the correct'],
  ['     Cloudbeds room type during migration.'],
  [],
  [],
  ['================================================================'],
  ['  GENDER  (normalized)'],
  ['================================================================'],
  [],
  ['  Final outgoing values are only:   M   |   F   |   N/A'],
  ['  Raw Excel gender text is never sent to the API.'],
  [],
  ['     → M:'],
  ['         Male, M, Man, Boy, Erkek, E'],
  [],
  ['     → F:'],
  ['         Female, F, Woman, Girl, Kadın, Kadin, Bayan, Kız, Kiz'],
  [],
  ['     → N/A:'],
  ['         Blank, unknown, or unsupported values'],
  [],
  [],
  ['================================================================'],
  ['  COUNTRY  (normalized to ISO2)'],
  ['================================================================'],
  [],
  ['  •  All countries are normalized to a 2-letter ISO code before'],
  ['     sending. This field is always populated.'],
  ['  •  Accepted inputs: ISO2, ISO3, English name, or Turkish name.'],
  ['  •  If the value cannot be resolved, the fallback is TR.'],
  [],
  ['     Examples:'],
  ['         TUR  /  Turkey  /  Türkiye                          → TR'],
  ['         USA  /  United States  /  Amerika Birleşik Devletleri → US'],
  ['         DEU  /  Germany  /  Almanya                          → DE'],
  [],
  [],
  ['================================================================'],
  ['  PAYMENT METHOD  (normalized)'],
  ['================================================================'],
  [],
  ['  Final outgoing values are only:   credit  |  ebanking  |  cash'],
  [],
  ['     → credit  (card-like values):'],
  ['         Visa, MC, Amex, VI, VA, Mastercard, Master Card,'],
  ['         Credit Card, CC, Card'],
  [],
  ['     → ebanking  (bank-transfer-like values):'],
  ['         Bank, Bank Transfer, EFT, Havale, Wire,'],
  ['         any phrase containing bank / eft / transfer'],
  [],
  ['     → cash  (everything else)'],
  [],
  [],
  ['================================================================'],
  ['  SOURCE CODE'],
  ['================================================================'],
  [],
  ['  •  Enter the source name/code (e.g. Direct - Hotel, Booking.com),'],
  ['     NOT the Cloudbeds source ID.'],
  ['  •  The value may be simplified — the app similarity-matches it'],
  ['     against the available Cloudbeds sources.'],
  [],
  ['     Matching order:'],
  ['         1. case-insensitive exact match'],
  ['         2. normalized exact match'],
  ['         3. contains / similarity (closest valid match wins)'],
  [],
  ['  •  If Source Code is left BLANK, the configured default is used:'],
  ['         past reservations    →  configured "past" default source'],
  ['                                  (e.g. FORMERPMS)'],
  ['         future reservations  →  configured "future" default source'],
  ['                                  (e.g. Direct - Hotel)'],
  ['  •  Defaults are configured on the Source Configuration page.'],
  [],
  [],
  ['================================================================'],
  ['  RATE CODE'],
  ['================================================================'],
  [],
  ['  •  Enter the rate plan public name if applicable.'],
  ['  •  The value may be simplified — the app similarity-matches it'],
  ['     against the configured rates for the row\'s room type.'],
  ['  •  Matching tolerates dash / no-dash / spacing differences.'],
  [],
  ['     Examples (all collapse to the same configured rate):'],
  ['         directro  /  direct-ro  /  direct ro   →  Direct-RO'],
  ['         walkin    /  walk-in    /  walk in     →  Walkin'],
  ['         formerpms                              →  FORMERPMS'],
  [],
  ['  •  If Rate Code is left BLANK, the configured default is used:'],
  ['         past reservations    →  configured default historical rate'],
  ['                                  (e.g. FORMERPMS)'],
  ['         future reservations  →  configured default future rate'],
  ['                                  (e.g. Walkin)'],
  ['  •  Defaults are configured on the Rate Configuration page.'],
  [],
  [],
  ['================================================================'],
  ['  EMAIL'],
  ['================================================================'],
  [],
  ['  •  If Email is left blank, a generic email is auto-generated:'],
  [],
  ['         migration+{rowNumber}@example.com'],
  [],
  ['  •  sendEmailConfirmation is ALWAYS sent as false.'],
  ['     Guests never receive a confirmation email during migration.'],
  [],
  [],
  ['================================================================'],
  ['  ZIP'],
  ['================================================================'],
  [],
  ['  •  The Zip column is ignored.'],
  ['  •  It is intentionally left blank / omitted from every payload.'],
  [],
  [],
  ['================================================================'],
  ['  DEFAULT VALUES  (applied when cell is blank)'],
  ['================================================================'],
  [],
  ['         Payment Method   →  cash'],
  ['         Room Count       →  1'],
  ['         Adult            →  1'],
  ['         Child            →  0'],
  ['         Source Code      →  configured past / future default'],
  ['         Rate Code        →  configured past / future default'],
  [],
  [],
  ['================================================================'],
  ['  PAYMENT NOTE'],
  ['================================================================'],
  [],
  ['  •  Payment information is recorded for reference only.'],
  ['  •  No financial transactions are performed during migration.'],
];

// ---------------------------------------------------------------------------
// Example rows for the Reservations sheet
// ---------------------------------------------------------------------------

const EXAMPLE_ROWS: Record<string, string | number>[] = [
  {
    'Arrival *': '2025-07-01',
    'Departure *': '2025-07-05',
    'First Name *': 'John',
    'Last Name *': 'Doe',
    'Room Count': 1,
    'Room Type *': 'STD',
    'Adult *': 2,
    'Child': 0,
    'Email *': 'john.doe@example.com',
    'Country *': 'US',
    'Payment Method *': 'cash',
    'Source Code': 'Direct - Hotel',
    '3rd Party Code': '',
    'Gender': 'Male',
    'Zip': '10001',
    'Mobile': '+1-555-0100',
    'Requirements': '',
    'ETA': '14:00',
    'Rate Code': 'Walkin',
    'Custom Field': '',
    'Promo Code': '',
    'Allotment Code': '',
    'Group Code': '',
    'Creation Date': '2025-06-20',
    'Email Confirmation': 'false',
  },
  {
    'Arrival *': '2025-08-10',
    'Departure *': '2025-08-12',
    'First Name *': 'Jane',
    'Last Name *': 'Smith',
    'Room Count': 1,
    'Room Type *': 'DLX',
    'Adult *': 1,
    'Child': 1,
    'Email *': '',
    'Country *': 'GB',
    'Payment Method *': '',
    'Source Code': 'Booking.com',
    '3rd Party Code': 'BK-123456',
    'Gender': 'Female',
    'Zip': '',
    'Mobile': '',
    'Requirements': 'Late check-in',
    'ETA': '22:00',
    'Rate Code': '',
    'Custom Field': '',
    'Promo Code': '',
    'Allotment Code': '',
    'Group Code': '',
    'Creation Date': '',
    'Email Confirmation': '',
  },
];

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

export function generateReservationTemplate(): void {
  info('ExcelTemplate', 'generate', 'Generating reservation template');

  const wb = XLSX.utils.book_new();

  // Sheet 1: Instructions — wider single column for breathing room.
  const instrWs = XLSX.utils.aoa_to_sheet(INSTRUCTION_ROWS);
  instrWs['!cols'] = [{ wch: 78 }];
  XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

  // Sheet 2: Reservations
  const headers = RESERVATION_COLUMNS.map((c) => c.header);
  const dataRows = EXAMPLE_ROWS.map((row) => headers.map((h) => row[h] ?? ''));
  const resWs = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  resWs['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, resWs, 'Reservations');

  XLSX.writeFile(wb, 'cloudbeds-reservation-template.xlsx');
  info('ExcelTemplate', 'generate', 'Template downloaded');
}

export function generateProfilesTemplate(): void {
  info('ExcelTemplate', 'generate', 'Generating profiles template (placeholder)');

  const wb = XLSX.utils.book_new();

  const instrWs = XLSX.utils.aoa_to_sheet([
    ['Cloudbeds Profiles Migration Template — Instructions'],
    [],
    ['This template is a placeholder. Full profile migration columns will be added later.'],
  ]);
  instrWs['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

  const profileWs = XLSX.utils.aoa_to_sheet([
    ['First Name *', 'Last Name *', 'Email', 'Phone', 'Country', 'Notes'],
    ['John', 'Doe', 'john@example.com', '+1-555-0100', 'US', ''],
  ]);
  profileWs['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, profileWs, 'Profiles');

  XLSX.writeFile(wb, 'cloudbeds-profiles-template.xlsx');
  info('ExcelTemplate', 'generate', 'Profiles template downloaded (placeholder)');
}

function generateSimpleModuleTemplate(
  fileName: string,
  title: string,
  sheetName: string,
  headers: string[],
  exampleRows: Array<Record<string, string>>,
): void {
  const wb = XLSX.utils.book_new();
  const instructionSheet = XLSX.utils.aoa_to_sheet([
    [title],
    [],
    ['Use this worksheet as the starting point for the migration module.'],
    ['Populate the sheet below and return to the application to review the file before executing.'],
  ]);
  instructionSheet['!cols'] = [{ wch: 84 }];
  XLSX.utils.book_append_sheet(wb, instructionSheet, 'Instructions');

  const dataRows = exampleRows.map((row) => headers.map((header) => row[header] ?? ''));
  const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
  dataSheet['!cols'] = headers.map((header) => ({ wch: Math.max(header.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, dataSheet, sheetName);

  XLSX.writeFile(wb, fileName);
}

export function generateReservationDetailTemplate(): void {
  info('ExcelTemplate', 'generate', 'Generating reservation detail template');
  generateSimpleModuleTemplate(
    'cloudbeds-reservation-detail-template.xlsx',
    'Cloudbeds Reservation Detail Migration Template',
    'Reservation Detail',
    ['Reservation Number', 'Guest Name', 'Detail Type', 'Detail Value'],
    [
      {
        'Reservation Number': 'CBR-10001',
        'Guest Name': 'John Doe',
        'Detail Type': 'Special Request',
        'Detail Value': 'Late arrival',
      },
    ],
  );
}

export function generateFinanceTemplate(): void {
  info('ExcelTemplate', 'generate', 'Generating finance template');
  generateSimpleModuleTemplate(
    'cloudbeds-finance-template.xlsx',
    'Cloudbeds Finance Migration Template',
    'Finance',
    ['Reservation Number', 'Profile Number', 'Charge Code', 'Amount'],
    [
      {
        'Reservation Number': 'CBR-10001',
        'Profile Number': 'PF-22001',
        'Charge Code': 'ROOM',
        Amount: '149.00',
      },
    ],
  );
}

export function validateSimpleModuleFile(
  file: File,
  expectedSheetName: string,
  requiredHeaders: string[],
): Promise<ValidationResult> {
  info('ExcelValidation', 'start', `Validating module file: ${file.name}`, {
    expectedSheetName,
    requiredHeaders,
  });

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({
        fileName: file.name,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: ['Failed to read the file. Please check the file and try again.'],
        validRowNumbers: [],
        invalidRowNumbers: [],
        rowIssues: {},
      });
    };

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheetName = wb.SheetNames.find((name) => name.toLowerCase() === expectedSheetName.toLowerCase());

        if (!sheetName) {
          resolve({
            fileName: file.name,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: [`Sheet "${expectedSheetName}" not found.`],
            validRowNumbers: [],
            invalidRowNumbers: [],
            rowIssues: {},
          });
          return;
        }

        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
          defval: '',
          raw: false,
        });

        if (rows.length === 0) {
          resolve({
            fileName: file.name,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: [`The "${expectedSheetName}" sheet has no data rows.`],
            validRowNumbers: [],
            invalidRowNumbers: [],
            rowIssues: {},
          });
          return;
        }

        const fileHeaders = Object.keys(rows[0] ?? {});
        const missingHeaders = requiredHeaders.filter((header) => !fileHeaders.includes(header));

        if (missingHeaders.length > 0) {
          resolve({
            fileName: file.name,
            totalRows: rows.length,
            validRows: 0,
            invalidRows: rows.length,
            errors: [`Missing required columns: ${missingHeaders.join(', ')}.`],
            validRowNumbers: [],
            invalidRowNumbers: rows.map((_, index) => index + 2),
            rowIssues: {},
          });
          return;
        }

        resolve({
          fileName: file.name,
          totalRows: rows.length,
          validRows: rows.length,
          invalidRows: 0,
          errors: [],
          validRowNumbers: rows.map((_, index) => index + 2),
          invalidRowNumbers: [],
          rowIssues: {},
        });
      } catch (err) {
        resolve({
          fileName: file.name,
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          errors: [`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`],
          validRowNumbers: [],
          invalidRowNumbers: [],
          rowIssues: {},
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: string[];
  validRowNumbers: number[];
  invalidRowNumbers: number[];
  rowIssues: Record<number, string[]>;
}

/**
 * Parse an uploaded .xlsx file and run first-pass validation.
 * Checks:
 *  - Reservations sheet exists
 *  - All required columns present
 *  - Required cells not empty (after defaults applied)
 */
export function validateReservationFile(file: File): Promise<ValidationResult> {
  info('ExcelValidation', 'start', `Validating file: ${file.name}`);

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      logError('ExcelValidation', 'read', 'FileReader error');
      resolve({
        fileName: file.name,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        errors: ['Failed to read the file. Please check the file and try again.'],
        validRowNumbers: [],
        invalidRowNumbers: [],
        rowIssues: {},
      });
    };

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });

        debug('ExcelValidation', 'parse', 'Workbook sheets', { sheets: wb.SheetNames });

        // Find Reservations sheet
        const sheetName = wb.SheetNames.find(
          (n) => n.toLowerCase() === 'reservations'
        );
        if (!sheetName) {
          warn('ExcelValidation', 'parse', 'Reservations sheet not found');
          resolve({
            fileName: file.name,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: [
              `Sheet "Reservations" not found. Found sheets: ${wb.SheetNames.join(', ')}. ` +
              'Please use the template generated by this application.',
            ],
            validRowNumbers: [],
            invalidRowNumbers: [],
            rowIssues: {},
          });
          return;
        }

        const ws = wb.Sheets[sheetName];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, {
          defval: '',
          raw: false,
        });

        debug('ExcelValidation', 'parse', 'Parsed rows', { count: rows.length });

        if (rows.length === 0) {
          resolve({
            fileName: file.name,
            totalRows: 0,
            validRows: 0,
            invalidRows: 0,
            errors: ['The Reservations sheet has no data rows.'],
            validRowNumbers: [],
            invalidRowNumbers: [],
            rowIssues: {},
          });
          return;
        }

        // Check required columns exist in header
        const fileHeaders = Object.keys(rows[0]);
        const missingCols = REQUIRED_HEADERS.filter(
          (rh) => !fileHeaders.some((fh) => fh.trim() === rh)
        );

        if (missingCols.length > 0) {
          warn('ExcelValidation', 'columns', 'Missing required columns', { missingCols });
          resolve({
            fileName: file.name,
            totalRows: rows.length,
            validRows: 0,
            invalidRows: rows.length,
            errors: [
              `Missing required columns: ${missingCols.join(', ')}. ` +
              'Please use the template generated by this application.',
            ],
            validRowNumbers: [],
            invalidRowNumbers: rows.map((_, index) => index + 2),
            rowIssues: {},
          });
          return;
        }

        // Per-row validation
        const errors: string[] = [];
        const validRowNumbers: number[] = [];
        const invalidRowNumbers: number[] = [];
        const rowIssues: Record<number, string[]> = {};
        let validCount = 0;
        let invalidCount = 0;

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2; // +2 for 1-indexed + header row
          const rowErrors: string[] = [];

          // Extract fields
          const arrival = (row['Arrival *'] ?? '').trim();
          const departure = (row['Departure *'] ?? '').trim();
          const firstName = (row['First Name *'] ?? '').trim();
          const lastName = (row['Last Name *'] ?? '').trim();
          const roomType = (row['Room Type *'] ?? '').trim();
          const country = (row['Country *'] ?? '').trim();
          const normalizedEmail = normalizeEmail(row['Email *']);
          // Email, Adult, Payment Method have defaults — blank is OK, not validated here

          // Strictly required — no default
          if (!arrival) rowErrors.push('Arrival is empty');
          if (!departure) rowErrors.push('Departure is empty');
          if (!firstName) rowErrors.push('First Name is empty');
          if (!lastName) rowErrors.push('Last Name is empty');
          if (!roomType) rowErrors.push('Room Type is empty');
          if (!country) rowErrors.push('Country is empty');

          // Date format checks
          if (arrival && !/^\d{4}-\d{2}-\d{2}$/.test(arrival)) {
            rowErrors.push(`Arrival "${arrival}" is not YYYY-MM-DD`);
          }
          if (departure && !/^\d{4}-\d{2}-\d{2}$/.test(departure)) {
            rowErrors.push(`Departure "${departure}" is not YYYY-MM-DD`);
          }

          // Departure > Arrival
          if (arrival && departure && departure <= arrival) {
            rowErrors.push('Departure must be later than Arrival');
          }

          // Country: any non-empty value is accepted here. The migration
          // normalizes ISO2 / ISO3 / English / Turkish names to ISO2 (with TR
          // fallback), so this validation no longer rejects non-ISO2 inputs.

          debug('ExcelValidation', 'row', `Row ${rowNum}: validation inspected`, {
            rowNum,
            normalizedEmail: normalizedEmail || '(blank)',
            hasErrors: rowErrors.length > 0,
          });

          if (rowErrors.length > 0) {
            invalidCount++;
            invalidRowNumbers.push(rowNum);
            rowIssues[rowNum] = rowErrors;
            // Cap detailed errors to avoid flooding
            if (errors.length < 50) {
              errors.push(`Row ${rowNum}: ${rowErrors.join('; ')}`);
            }
          } else {
            validCount++;
            validRowNumbers.push(rowNum);
          }
        }

        if (invalidCount > 0 && errors.length >= 50) {
          errors.push(`... and ${invalidCount - 50} more rows with errors.`);
        }

        const result: ValidationResult = {
          fileName: file.name,
          totalRows: rows.length,
          validRows: validCount,
          invalidRows: invalidCount,
          errors,
          validRowNumbers,
          invalidRowNumbers,
          rowIssues,
        };

        info('ExcelValidation', 'complete', `Validation done: ${validCount} valid, ${invalidCount} invalid out of ${rows.length}`);
        debug('ExcelValidation', 'complete', 'Validation result', result);

        resolve(result);
      } catch (err) {
        logError('ExcelValidation', 'parse', 'Unexpected error during validation', { error: String(err) });
        resolve({
          fileName: file.name,
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          errors: [`Failed to parse file: ${err instanceof Error ? err.message : String(err)}`],
          validRowNumbers: [],
          invalidRowNumbers: [],
          rowIssues: {},
        });
      }
    };

    reader.readAsArrayBuffer(file);
  });
}
