// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------
// Pure functions used by the migration flow to normalize Excel input values
// before they are sent to the Cloudbeds API. Kept separate so the rules can
// be unit-tested and reused without pulling in any side effects.
// ---------------------------------------------------------------------------

// ===========================================================================
// Gender
// ===========================================================================

export type NormalizedGender = 'M' | 'F' | 'N/A';

const MALE_TOKENS = new Set([
  'm', 'male', 'man', 'boy',
  // Turkish
  'e', 'erkek',
]);

const FEMALE_TOKENS = new Set([
  'f', 'female', 'woman', 'girl',
  // Turkish
  'kadin', 'kadın', 'bayan', 'kiz', 'kız',
]);

/**
 * Normalize a raw gender value into one of: 'M', 'F', 'N/A'.
 * Case-insensitive. Trims whitespace. Accepts English and Turkish variants.
 * Anything not recognized (including blank/null) becomes 'N/A'.
 */
export function normalizeGender(raw: string | null | undefined): NormalizedGender {
  if (raw == null) return 'N/A';
  const v = String(raw).trim().toLowerCase();
  if (!v) return 'N/A';
  if (MALE_TOKENS.has(v)) return 'M';
  if (FEMALE_TOKENS.has(v)) return 'F';
  return 'N/A';
}

// ===========================================================================
// Country
// ===========================================================================

interface CountryEntry {
  iso2: string;
  iso3: string;
  en: string;
  tr?: string;
  aliases?: string[];
}

const COUNTRIES: CountryEntry[] = [
  { iso2: 'TR', iso3: 'TUR', en: 'turkey', tr: 'türkiye', aliases: ['turkiye', 'türkiye cumhuriyeti', 'republic of turkey', 'republic of türkiye'] },
  { iso2: 'US', iso3: 'USA', en: 'united states', tr: 'amerika birleşik devletleri', aliases: ['usa', 'united states of america', 'america', 'amerika', 'abd', 'amerika birlesik devletleri'] },
  { iso2: 'GB', iso3: 'GBR', en: 'united kingdom', tr: 'birleşik krallık', aliases: ['uk', 'great britain', 'britain', 'england', 'birlesik krallik', 'ingiltere'] },
  { iso2: 'DE', iso3: 'DEU', en: 'germany', tr: 'almanya' },
  { iso2: 'FR', iso3: 'FRA', en: 'france', tr: 'fransa' },
  { iso2: 'IT', iso3: 'ITA', en: 'italy', tr: 'italya' },
  { iso2: 'ES', iso3: 'ESP', en: 'spain', tr: 'ispanya' },
  { iso2: 'NL', iso3: 'NLD', en: 'netherlands', tr: 'hollanda', aliases: ['holland', 'the netherlands'] },
  { iso2: 'BE', iso3: 'BEL', en: 'belgium', tr: 'belçika', aliases: ['belcika'] },
  { iso2: 'AT', iso3: 'AUT', en: 'austria', tr: 'avusturya' },
  { iso2: 'CH', iso3: 'CHE', en: 'switzerland', tr: 'isviçre', aliases: ['isvicre'] },
  { iso2: 'SE', iso3: 'SWE', en: 'sweden', tr: 'isveç', aliases: ['isvec'] },
  { iso2: 'NO', iso3: 'NOR', en: 'norway', tr: 'norveç', aliases: ['norvec'] },
  { iso2: 'DK', iso3: 'DNK', en: 'denmark', tr: 'danimarka' },
  { iso2: 'FI', iso3: 'FIN', en: 'finland', tr: 'finlandiya' },
  { iso2: 'IE', iso3: 'IRL', en: 'ireland', tr: 'irlanda' },
  { iso2: 'PT', iso3: 'PRT', en: 'portugal', tr: 'portekiz' },
  { iso2: 'GR', iso3: 'GRC', en: 'greece', tr: 'yunanistan' },
  { iso2: 'PL', iso3: 'POL', en: 'poland', tr: 'polonya' },
  { iso2: 'CZ', iso3: 'CZE', en: 'czech republic', tr: 'çek cumhuriyeti', aliases: ['czechia', 'cek cumhuriyeti'] },
  { iso2: 'SK', iso3: 'SVK', en: 'slovakia', tr: 'slovakya' },
  { iso2: 'HU', iso3: 'HUN', en: 'hungary', tr: 'macaristan' },
  { iso2: 'RO', iso3: 'ROU', en: 'romania', tr: 'romanya' },
  { iso2: 'BG', iso3: 'BGR', en: 'bulgaria', tr: 'bulgaristan' },
  { iso2: 'HR', iso3: 'HRV', en: 'croatia', tr: 'hırvatistan', aliases: ['hirvatistan'] },
  { iso2: 'SI', iso3: 'SVN', en: 'slovenia', tr: 'slovenya' },
  { iso2: 'RS', iso3: 'SRB', en: 'serbia', tr: 'sırbistan', aliases: ['sirbistan'] },
  { iso2: 'BA', iso3: 'BIH', en: 'bosnia and herzegovina', tr: 'bosna hersek', aliases: ['bosnia', 'bosna ve hersek'] },
  { iso2: 'AL', iso3: 'ALB', en: 'albania', tr: 'arnavutluk' },
  { iso2: 'MK', iso3: 'MKD', en: 'north macedonia', tr: 'kuzey makedonya', aliases: ['macedonia', 'makedonya'] },
  { iso2: 'ME', iso3: 'MNE', en: 'montenegro', tr: 'karadağ', aliases: ['karadag'] },
  { iso2: 'XK', iso3: 'XKX', en: 'kosovo', tr: 'kosova' },
  { iso2: 'RU', iso3: 'RUS', en: 'russia', tr: 'rusya', aliases: ['russian federation'] },
  { iso2: 'UA', iso3: 'UKR', en: 'ukraine', tr: 'ukrayna' },
  { iso2: 'BY', iso3: 'BLR', en: 'belarus', tr: 'belarus', aliases: ['beyaz rusya'] },
  { iso2: 'MD', iso3: 'MDA', en: 'moldova', tr: 'moldova' },
  { iso2: 'GE', iso3: 'GEO', en: 'georgia', tr: 'gürcistan', aliases: ['gurcistan'] },
  { iso2: 'AM', iso3: 'ARM', en: 'armenia', tr: 'ermenistan' },
  { iso2: 'AZ', iso3: 'AZE', en: 'azerbaijan', tr: 'azerbaycan' },
  { iso2: 'KZ', iso3: 'KAZ', en: 'kazakhstan', tr: 'kazakistan' },
  { iso2: 'UZ', iso3: 'UZB', en: 'uzbekistan', tr: 'özbekistan', aliases: ['ozbekistan'] },
  { iso2: 'TM', iso3: 'TKM', en: 'turkmenistan', tr: 'türkmenistan', aliases: ['turkmenistan'] },
  { iso2: 'KG', iso3: 'KGZ', en: 'kyrgyzstan', tr: 'kırgızistan', aliases: ['kirgizistan'] },
  { iso2: 'TJ', iso3: 'TJK', en: 'tajikistan', tr: 'tacikistan' },
  { iso2: 'CY', iso3: 'CYP', en: 'cyprus', tr: 'kıbrıs', aliases: ['kibris'] },
  { iso2: 'MT', iso3: 'MLT', en: 'malta', tr: 'malta' },
  { iso2: 'IS', iso3: 'ISL', en: 'iceland', tr: 'izlanda' },
  { iso2: 'LU', iso3: 'LUX', en: 'luxembourg', tr: 'lüksemburg', aliases: ['luksemburg'] },
  { iso2: 'EE', iso3: 'EST', en: 'estonia', tr: 'estonya' },
  { iso2: 'LV', iso3: 'LVA', en: 'latvia', tr: 'letonya' },
  { iso2: 'LT', iso3: 'LTU', en: 'lithuania', tr: 'litvanya' },
  { iso2: 'CA', iso3: 'CAN', en: 'canada', tr: 'kanada' },
  { iso2: 'MX', iso3: 'MEX', en: 'mexico', tr: 'meksika' },
  { iso2: 'BR', iso3: 'BRA', en: 'brazil', tr: 'brezilya' },
  { iso2: 'AR', iso3: 'ARG', en: 'argentina', tr: 'arjantin' },
  { iso2: 'CL', iso3: 'CHL', en: 'chile', tr: 'şili', aliases: ['sili'] },
  { iso2: 'CO', iso3: 'COL', en: 'colombia', tr: 'kolombiya' },
  { iso2: 'PE', iso3: 'PER', en: 'peru', tr: 'peru' },
  { iso2: 'VE', iso3: 'VEN', en: 'venezuela', tr: 'venezuela' },
  { iso2: 'CN', iso3: 'CHN', en: 'china', tr: 'çin', aliases: ['cin', 'peoples republic of china'] },
  { iso2: 'JP', iso3: 'JPN', en: 'japan', tr: 'japonya' },
  { iso2: 'KR', iso3: 'KOR', en: 'south korea', tr: 'güney kore', aliases: ['korea', 'guney kore', 'republic of korea'] },
  { iso2: 'KP', iso3: 'PRK', en: 'north korea', tr: 'kuzey kore' },
  { iso2: 'IN', iso3: 'IND', en: 'india', tr: 'hindistan' },
  { iso2: 'PK', iso3: 'PAK', en: 'pakistan', tr: 'pakistan' },
  { iso2: 'BD', iso3: 'BGD', en: 'bangladesh', tr: 'bangladeş', aliases: ['banglades'] },
  { iso2: 'ID', iso3: 'IDN', en: 'indonesia', tr: 'endonezya' },
  { iso2: 'MY', iso3: 'MYS', en: 'malaysia', tr: 'malezya' },
  { iso2: 'SG', iso3: 'SGP', en: 'singapore', tr: 'singapur' },
  { iso2: 'TH', iso3: 'THA', en: 'thailand', tr: 'tayland' },
  { iso2: 'VN', iso3: 'VNM', en: 'vietnam', tr: 'vietnam' },
  { iso2: 'PH', iso3: 'PHL', en: 'philippines', tr: 'filipinler' },
  { iso2: 'AU', iso3: 'AUS', en: 'australia', tr: 'avustralya' },
  { iso2: 'NZ', iso3: 'NZL', en: 'new zealand', tr: 'yeni zelanda' },
  { iso2: 'AE', iso3: 'ARE', en: 'united arab emirates', tr: 'birleşik arap emirlikleri', aliases: ['uae', 'emirates', 'birlesik arap emirlikleri', 'bae'] },
  { iso2: 'SA', iso3: 'SAU', en: 'saudi arabia', tr: 'suudi arabistan' },
  { iso2: 'QA', iso3: 'QAT', en: 'qatar', tr: 'katar' },
  { iso2: 'KW', iso3: 'KWT', en: 'kuwait', tr: 'kuveyt' },
  { iso2: 'BH', iso3: 'BHR', en: 'bahrain', tr: 'bahreyn' },
  { iso2: 'OM', iso3: 'OMN', en: 'oman', tr: 'umman' },
  { iso2: 'JO', iso3: 'JOR', en: 'jordan', tr: 'ürdün', aliases: ['urdun'] },
  { iso2: 'LB', iso3: 'LBN', en: 'lebanon', tr: 'lübnan', aliases: ['lubnan'] },
  { iso2: 'IL', iso3: 'ISR', en: 'israel', tr: 'israil' },
  { iso2: 'SY', iso3: 'SYR', en: 'syria', tr: 'suriye' },
  { iso2: 'IQ', iso3: 'IRQ', en: 'iraq', tr: 'irak' },
  { iso2: 'IR', iso3: 'IRN', en: 'iran', tr: 'iran' },
  { iso2: 'AF', iso3: 'AFG', en: 'afghanistan', tr: 'afganistan' },
  { iso2: 'EG', iso3: 'EGY', en: 'egypt', tr: 'mısır', aliases: ['misir'] },
  { iso2: 'LY', iso3: 'LBY', en: 'libya', tr: 'libya' },
  { iso2: 'TN', iso3: 'TUN', en: 'tunisia', tr: 'tunus' },
  { iso2: 'DZ', iso3: 'DZA', en: 'algeria', tr: 'cezayir' },
  { iso2: 'MA', iso3: 'MAR', en: 'morocco', tr: 'fas' },
  { iso2: 'ZA', iso3: 'ZAF', en: 'south africa', tr: 'güney afrika', aliases: ['guney afrika'] },
  { iso2: 'NG', iso3: 'NGA', en: 'nigeria', tr: 'nijerya' },
  { iso2: 'KE', iso3: 'KEN', en: 'kenya', tr: 'kenya' },
  { iso2: 'ET', iso3: 'ETH', en: 'ethiopia', tr: 'etiyopya' },
];

const ISO2_SET = new Set(COUNTRIES.map((c) => c.iso2));
const LOOKUP: Record<string, string> = {};
for (const c of COUNTRIES) {
  LOOKUP[c.iso2.toLowerCase()] = c.iso2;
  LOOKUP[c.iso3.toLowerCase()] = c.iso2;
  LOOKUP[c.en.toLowerCase()] = c.iso2;
  if (c.tr) LOOKUP[c.tr.toLowerCase()] = c.iso2;
  if (c.aliases) {
    for (const a of c.aliases) LOOKUP[a.toLowerCase()] = c.iso2;
  }
}

export interface CountryNormalizationResult {
  iso2: string;        // Always populated; falls back to 'TR' if unresolved
  resolved: boolean;   // True if the input matched a known country
}

/**
 * Normalize a raw country value to ISO2.
 *  - ISO2 → kept as-is (uppercased)
 *  - ISO3 → converted to ISO2
 *  - English name → converted to ISO2
 *  - Turkish name → converted to ISO2
 *
 * If the value cannot be resolved, falls back to 'TR' and sets resolved=false
 * so the caller can decide whether to log/warn.
 */
export function normalizeCountry(raw: string | null | undefined): CountryNormalizationResult {
  if (raw == null) return { iso2: 'TR', resolved: false };
  const trimmed = String(raw).trim();
  if (!trimmed) return { iso2: 'TR', resolved: false };

  // ISO2 fast path: any 2-letter code is kept as-is (uppercased).
  if (trimmed.length === 2 && /^[A-Za-z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    return { iso2: upper, resolved: ISO2_SET.has(upper) };
  }

  const key = trimmed.toLowerCase().replace(/\s+/g, ' ');
  const hit = LOOKUP[key];
  if (hit) return { iso2: hit, resolved: true };

  // Loose pass: strip Turkish diacritics
  const stripped = key
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
    .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
    .replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u');
  if (stripped !== key && LOOKUP[stripped]) {
    return { iso2: LOOKUP[stripped], resolved: true };
  }

  return { iso2: 'TR', resolved: false };
}

// ===========================================================================
// Payment method
// ===========================================================================

export type NormalizedPayment = 'credit' | 'ebanking' | 'cash';

const CREDIT_EXACT = new Set([
  'credit', 'credit card', 'creditcard', 'card',
  'cc', 'vi', 'va', 'mc',
  'visa', 'visa card',
  'mastercard', 'master card', 'master',
  'amex', 'american express',
  'maestro', 'discover', 'diners', 'diners club', 'jcb', 'unionpay',
]);

const BANK_KEYWORDS = ['bank', 'eft', 'transfer', 'havale', 'wire', 'ebanking', 'e banking', 'online bank'];

/**
 * Normalize a raw payment value to one of: 'credit', 'ebanking', 'cash'.
 *  - card-like values         → 'credit'
 *  - bank-transfer-like values → 'ebanking'
 *  - everything else           → 'cash'
 *
 * Bank keywords take precedence over card fuzzy matches so that strings like
 * "bank transfer" win over "card" if both happen to be present.
 */
export function normalizePayment(raw: string | null | undefined): NormalizedPayment {
  if (raw == null) return 'cash';
  // Normalize separators (underscore, dash) to spaces and collapse whitespace
  // so values like "BANK_TRANSFER" or "credit-card" match cleanly.
  const v = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!v) return 'cash';

  if (CREDIT_EXACT.has(v)) return 'credit';

  // Bank-related: phrases containing bank / eft / transfer / havale / wire
  for (const kw of BANK_KEYWORDS) {
    if (v.includes(kw)) return 'ebanking';
  }

  // Card-related fuzzy matches
  if (
    v.includes('credit') ||
    v.includes('visa') ||
    v.includes('master') ||
    v.includes('amex') ||
    v.includes('american express') ||
    v.includes('debit') ||
    v.includes('card')
  ) {
    return 'credit';
  }

  return 'cash';
}

// ===========================================================================
// Email
// ===========================================================================

const EMPTY_LIKE_EMAILS = new Set([
  '',
  '-',
  'n/a',
  'na',
  'none',
  'null',
  'undefined',
]);

/**
 * Clean an email value before validation / sending.
 *  - trims surrounding whitespace
 *  - removes internal whitespace characters
 *  - transliterates common non-ASCII characters to ASCII where safe
 *  - treats empty-like placeholders consistently as blank
 *
 * Blank output is intentional: the migration layer can then apply its
 * existing fallback email behavior without duplicating cleanup logic.
 */
export function normalizeEmail(raw: string | null | undefined): string {
  if (raw == null) return '';

  const trimmed = String(raw).trim();
  if (!trimmed) return '';

  const lowered = trimmed.toLowerCase();
  if (EMPTY_LIKE_EMAILS.has(lowered)) return '';

  const hasNonAscii = /[^\x00-\x7F]/.test(trimmed);
  if (!hasNonAscii) {
    return trimmed;
  }

  const transliterated = trimmed
    .replace(/İ/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/Æ/g, 'AE')
    .replace(/æ/g, 'ae')
    .replace(/Ø/g, 'O')
    .replace(/ø/g, 'o')
    .replace(/Œ/g, 'OE')
    .replace(/œ/g, 'oe')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x00-\x7F]/g, '');

  return transliterated.trim();
}

// ===========================================================================
// Source / Rate matching keys
// ===========================================================================

/**
 * Produce a comparison key for source matching:
 *  - lowercase
 *  - trim
 *  - collapse repeated whitespace
 *  - normalize underscores and dashes to spaces
 *  - drop punctuation (including '.', ',', '/', etc.) so variants like
 *    "Booking.com", "booking com", "BOOKING-COM" all collapse to "booking com"
 */
export function normalizeSourceKey(raw: string | null | undefined): string {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ===========================================================================
// Date / time
// ===========================================================================
//
// Centralized date normalization used by the Reservation migration flow.
//
// Accepted raw formats:
//   - YYYY-MM-DD                           (ISO date, preferred)
//   - YYYY-MM-DD HH:mm[:ss]                (ISO date + time)
//   - ISO 8601 with 'T' and optional tz    ("2026-04-15T09:30:00", "...Z")
//   - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY   (EU / TR bias, day-first)
//   - MM/DD/YYYY                           (US fallback when unambiguous)
//   - Excel serial numbers (e.g. 45015)
//   - Anything JS `new Date()` can parse reliably
//
// Philosophy:
//   - Never silently produce a wrong date. If the value is ambiguous in a
//     way the helper cannot resolve, return null and let the caller treat it
//     as a validation error.
//   - When both EU (day-first) and US (month-first) interpretations are
//     possible and different, we prefer day-first — the migration operators
//     are in Turkey / Europe. When day-first is impossible (e.g. "13/05/2026"
//     with day > 12), we disambiguate naturally.
//

/**
 * Convert a numeric Excel date serial to a UTC Date.
 *
 * Excel's epoch is 1900-01-01 but it has a 1900 leap-year bug: the fictional
 * Feb 29, 1900 (serial 60) exists. Serials ≥ 60 shift by one day.
 */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  // Day 1 = 1900-01-01; adjust for 1900 bug.
  const shift = serial >= 60 ? 1 : 0;
  const ms = Math.round((serial - 25569 - shift) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatYmd(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function formatYmdHms(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): string {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const ss = String(second).padStart(2, '0');
  return `${formatYmd(year, month, day)} ${hh}:${mm}:${ss}`;
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 2999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

interface ParsedDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  hasTime: boolean;
}

function apply12HourSuffix(hour: number, suffix: string | null): number | null {
  if (!suffix) return hour;
  const s = suffix.toLowerCase();
  if (s !== 'am' && s !== 'pm') return null;
  if (hour < 1 || hour > 12) return null;
  if (s === 'am') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function parseTimeTail(tail: string): { hour: number; minute: number; second: number } | null {
  const trimmed = tail.trim();
  if (!trimmed) return { hour: 0, minute: 0, second: 0 };
  // e.g. "09:30", "09:30:15", "9:30 AM", "14:00:00"
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/.exec(trimmed);
  if (!m) return null;
  const rawHour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] ? Number(m[3]) : 0;
  const suffix = m[4] ?? null;
  if (minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const hour = suffix ? apply12HourSuffix(rawHour, suffix) : rawHour;
  if (hour == null || hour < 0 || hour > 23) return null;
  return { hour, minute, second };
}

function parseAnyDate(raw: unknown): ParsedDateParts | null {
  if (raw == null) return null;

  // Excel date objects (SheetJS with cellDates)
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return {
      year: raw.getUTCFullYear(),
      month: raw.getUTCMonth() + 1,
      day: raw.getUTCDate(),
      hour: raw.getUTCHours(),
      minute: raw.getUTCMinutes(),
      second: raw.getUTCSeconds(),
      hasTime: raw.getUTCHours() !== 0 || raw.getUTCMinutes() !== 0 || raw.getUTCSeconds() !== 0,
    };
  }

  // Numeric Excel serial
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const d = excelSerialToDate(raw);
    if (!d) return null;
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      hasTime: d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0,
    };
  }

  let str = String(raw).trim();
  if (!str) return null;

  // Purely numeric string → treat as Excel serial
  if (/^\d+(?:\.\d+)?$/.test(str)) {
    const n = Number(str);
    const d = excelSerialToDate(n);
    if (!d) return null;
    return {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      hasTime: d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0,
    };
  }

  // ISO-like date (optionally with T-separator and timezone):
  //   2026-04-15
  //   2026-04-15 09:30
  //   2026-04-15T09:30:00
  //   2026-04-15T09:30:00Z
  //   2026-04-15T09:30:00+03:00
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(str);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    if (!isValidYmd(year, month, day)) return null;
    const hasTime = !!isoMatch[4];
    const hour = hasTime ? Number(isoMatch[4]) : 0;
    const minute = hasTime ? Number(isoMatch[5]) : 0;
    const second = isoMatch[6] ? Number(isoMatch[6]) : 0;
    if (hasTime && (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59)) return null;
    return { year, month, day, hour, minute, second, hasTime };
  }

  // Split off optional time tail for slash/dot/dash dates.
  let timeParts: { hour: number; minute: number; second: number } | null = {
    hour: 0,
    minute: 0,
    second: 0,
  };
  let hasTime = false;
  const spaceIdx = str.indexOf(' ');
  if (spaceIdx > 0) {
    const tail = str.slice(spaceIdx + 1);
    const parsedTail = parseTimeTail(tail);
    if (parsedTail) {
      timeParts = parsedTail;
      hasTime = true;
      str = str.slice(0, spaceIdx).trim();
    }
  }

  // DD/MM/YYYY or MM/DD/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(str);
  if (numeric) {
    const a = Number(numeric[1]);
    const b = Number(numeric[2]);
    const year = Number(numeric[3]);
    // Day-first bias. If day-first is invalid but month-first is valid,
    // take month-first. If both valid and different, day-first wins (EU/TR).
    const dayFirstValid = isValidYmd(year, b, a);
    const monthFirstValid = isValidYmd(year, a, b);
    if (dayFirstValid) {
      return {
        year,
        month: b,
        day: a,
        hour: timeParts!.hour,
        minute: timeParts!.minute,
        second: timeParts!.second,
        hasTime,
      };
    }
    if (monthFirstValid) {
      return {
        year,
        month: a,
        day: b,
        hour: timeParts!.hour,
        minute: timeParts!.minute,
        second: timeParts!.second,
        hasTime,
      };
    }
    return null;
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const isoAlt = /^(\d{4})[./](\d{1,2})[./](\d{1,2})$/.exec(str);
  if (isoAlt) {
    const year = Number(isoAlt[1]);
    const month = Number(isoAlt[2]);
    const day = Number(isoAlt[3]);
    if (!isValidYmd(year, month, day)) return null;
    return {
      year,
      month,
      day,
      hour: timeParts!.hour,
      minute: timeParts!.minute,
      second: timeParts!.second,
      hasTime,
    };
  }

  // Last resort: let JS Date handle it (covers JS Date.toString() etc.)
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return {
      year: fallback.getUTCFullYear(),
      month: fallback.getUTCMonth() + 1,
      day: fallback.getUTCDate(),
      hour: fallback.getUTCHours(),
      minute: fallback.getUTCMinutes(),
      second: fallback.getUTCSeconds(),
      hasTime:
        fallback.getUTCHours() !== 0 ||
        fallback.getUTCMinutes() !== 0 ||
        fallback.getUTCSeconds() !== 0,
    };
  }

  return null;
}

/**
 * Normalize any supported date input to `YYYY-MM-DD`.
 * Returns null when the input cannot be interpreted unambiguously.
 * Time components, if any, are discarded.
 */
export function normalizeApiDate(raw: unknown): string | null {
  const parts = parseAnyDate(raw);
  if (!parts) return null;
  if (!isValidYmd(parts.year, parts.month, parts.day)) return null;
  return formatYmd(parts.year, parts.month, parts.day);
}

/**
 * Normalize any supported date-time input to `YYYY-MM-DD HH:mm:ss`.
 * Date-only inputs are padded with 00:00:00.
 * Returns null when the input cannot be interpreted.
 */
export function normalizeApiDateTime(raw: unknown): string | null {
  const parts = parseAnyDate(raw);
  if (!parts) return null;
  if (!isValidYmd(parts.year, parts.month, parts.day)) return null;
  return formatYmdHms(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
}

/**
 * Normalize a time-of-day input (e.g. ETA) to `HH:mm`.
 * Accepts "14:00", "14:00:00", "2 PM", "2:30 pm", or a full date-time string.
 * Returns null when the input cannot be interpreted.
 */
export function normalizeApiTime(raw: unknown): string | null {
  if (raw == null) return null;
  const str = String(raw).trim();
  if (!str) return null;

  // Plain time-only first.
  const timeOnly = parseTimeTail(str);
  if (timeOnly) {
    return `${String(timeOnly.hour).padStart(2, '0')}:${String(timeOnly.minute).padStart(2, '0')}`;
  }

  // Otherwise, try as a full date-time and pull the time off the end.
  const parts = parseAnyDate(raw);
  if (!parts || !parts.hasTime) return null;
  return `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

/**
 * Produce a comparison key for rate matching:
 *  - lowercase
 *  - trim
 *  - remove dashes, underscores, and whitespace entirely
 *
 * Examples (all map to the same key):
 *   "direct-ro", "direct ro", "DirectRO", "directro" → "directro"
 *   "walk-in", "walk in", "Walkin"                   → "walkin"
 *   "FORMERPMS", "formerpms"                         → "formerpms"
 */
export function normalizeRateKey(raw: string | null | undefined): string {
  if (raw == null) return '';
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/[\s_\-]+/g, '');
}
