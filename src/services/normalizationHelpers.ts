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

// ===========================================================================
// Dates / times
// ===========================================================================
//
// All Cloudbeds API date fields are passed through here so the migration flow
// never sends a raw Excel cell. The rules are strict: if the input can't be
// parsed with confidence, the helper returns null and the caller is expected
// to mark the row as a VALIDATION_ERROR. We never silently reinterpret an
// ambiguous value as something else.
//
// Supported input shapes (all trimmed before matching):
//   - ISO date:      2024-05-17
//   - ISO datetime:  2024-05-17T14:30:00[Z|±HH:mm], 2024-05-17 14:30[:ss]
//   - Day-first:     17/05/2024, 17-05-2024, 17.05.2024  (with optional time)
//   - Month-first:   05/17/2024 (only when unambiguous — day > 12)
//   - Excel serial:  a plain number or numeric string (1899 date system with
//                    the Excel 1900-leap-year bug preserved)
//   - JS Date fallback: anything Date(raw) can parse that still resolves to a
//                    real calendar date
//
// Ambiguity policy: when both components are ≤ 12 (e.g. 03/04/2024) we treat
// the input as day-first, matching the Turkish / European bias of this tool.

const EMPTY_LIKE_DATES = new Set(['', '-', '--', 'n/a', 'na', 'none', 'null', 'undefined']);

/** Clamp year to a sane window so typos don't produce year 20 or 20240. */
function isReasonableYear(y: number): boolean {
  return y >= 1900 && y <= 9999;
}

/** Zero-pad a number to 2 digits. */
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Zero-pad a number to 4 digits. */
function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Build a UTC date from component parts while validating that the components
 * actually round-trip (rejects 2024-02-30, 2024-13-01, etc.).
 */
function composeUtcDate(
  y: number,
  m: number,
  d: number,
  hh = 0,
  mm = 0,
  ss = 0,
): Date | null {
  if (!isReasonableYear(y)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59 || ss < 0 || ss > 59) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm, ss));
  if (isNaN(dt.getTime())) return null;
  // Reject rollover (e.g. Feb 30 → Mar 2).
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

/** Format a UTC-anchored Date as YYYY-MM-DD. */
function formatYmd(dt: Date): string {
  return `${pad4(dt.getUTCFullYear())}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** Format a UTC-anchored Date as YYYY-MM-DD HH:mm:ss (API datetime shape). */
function formatYmdHms(dt: Date): string {
  return `${formatYmd(dt)} ${pad2(dt.getUTCHours())}:${pad2(dt.getUTCMinutes())}:${pad2(dt.getUTCSeconds())}`;
}

/**
 * Excel 1900 date system → JS Date.
 *
 * Excel's serial 1 == 1900-01-01. The 1900-02-29 leap-year bug means serials
 * ≥ 60 are off by one; we compensate so the output matches what Excel
 * displays.
 *
 * Returns null for values outside [1, 2958465] (≈ 9999-12-31).
 */
function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  if (serial < 1 || serial > 2958465) return null;
  // Days since 1899-12-30, offset by the 1900-leap-year bug for serials ≥ 60.
  const offset = serial < 60 ? 1 : 0;
  const ms = Math.round((serial - 25569 + offset) * 86400000);
  const dt = new Date(ms);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

/**
 * Parse optional trailing time from a token like "14:30" / "14:30:45".
 * Returns { hh, mm, ss } or null if unparseable.
 */
function parseTimeTail(raw: string): { hh: number; mm: number; ss: number } | null {
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  return {
    hh: Number(m[1]),
    mm: Number(m[2]),
    ss: m[3] ? Number(m[3]) : 0,
  };
}

/**
 * Decide whether a prepared string is blank-like. Keep in sync with the
 * blank-like tokens used by the email normalizer so the whole migration flow
 * treats missing values consistently.
 */
function isBlankDateToken(raw: string): boolean {
  return EMPTY_LIKE_DATES.has(raw.toLowerCase());
}

/**
 * Core parser shared by normalizeApiDate / normalizeApiDateTime. Returns a
 * UTC-anchored Date plus a flag indicating whether the input carried a time
 * component.
 *
 * Never reinterprets an unambiguous input — e.g. "13/04/2024" is always
 * day-first because month 13 is impossible.
 */
function parseAnyDate(raw: string | null | undefined): { date: Date; hasTime: boolean } | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || isBlankDateToken(trimmed)) return null;

  // --- Pure Excel serial (e.g. "45398" or "45398.5") ---
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    const dt = excelSerialToDate(serial);
    if (dt) {
      const hasTime = serial % 1 !== 0;
      return { date: dt, hasTime };
    }
    return null;
  }

  // --- ISO shapes: YYYY-MM-DD or YYYY-MM-DDTHH:mm[:ss][Z|±HH:mm] or
  //     YYYY-MM-DD HH:mm[:ss] / YYYY/MM/DD[ HH:mm[:ss]] ---
  {
    const m = trimmed.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/,
    );
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const hh = m[4] != null ? Number(m[4]) : 0;
      const mm = m[5] != null ? Number(m[5]) : 0;
      const ss = m[6] != null ? Number(m[6]) : 0;
      // If a timezone suffix is present, use Date parsing so the offset is
      // applied correctly; otherwise compose in UTC to avoid local-timezone
      // drift altering the calendar date.
      if (m[7]) {
        const dt = new Date(trimmed);
        if (!isNaN(dt.getTime())) {
          return { date: dt, hasTime: m[4] != null };
        }
        return null;
      }
      const dt = composeUtcDate(y, mo, d, hh, mm, ss);
      if (!dt) return null;
      return { date: dt, hasTime: m[4] != null };
    }
  }

  // --- Slash / dash / dot-separated with 4-digit year on either end ---
  //     17/05/2024, 17-05-2024, 17.05.2024, 05/17/2024, optionally with time
  {
    const m = trimmed.match(
      /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
    );
    if (m) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      let y = Number(m[3]);
      if (m[3].length === 2) {
        // Two-digit year: 00-69 → 2000s, 70-99 → 1900s (common in Excel
        // exports). Anything outside wins up as an unreasonable year and
        // fails validation below.
        y = y <= 69 ? 2000 + y : 1900 + y;
      }
      let day: number;
      let month: number;
      if (a > 12 && b <= 12) {
        day = a;
        month = b;
      } else if (b > 12 && a <= 12) {
        day = b;
        month = a;
      } else {
        // Both ≤ 12 → treat as day-first (EU/TR convention used by this tool).
        day = a;
        month = b;
      }
      const hh = m[4] != null ? Number(m[4]) : 0;
      const mm = m[5] != null ? Number(m[5]) : 0;
      const ss = m[6] != null ? Number(m[6]) : 0;
      const dt = composeUtcDate(y, month, day, hh, mm, ss);
      if (!dt) return null;
      return { date: dt, hasTime: m[4] != null };
    }
  }

  // --- Last-resort JS Date fallback (covers "May 17 2024", RFC 2822, etc.).
  //     Only accept if the resulting year is reasonable.
  {
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime()) && isReasonableYear(dt.getUTCFullYear())) {
      // If the trimmed string clearly lacks a time, flag hasTime=false so
      // date-only callers don't emit a bogus 00:00:00 datetime.
      const hasTime = /\d:\d/.test(trimmed);
      return { date: dt, hasTime };
    }
  }

  return null;
}

/** Parse `parseTimeTail` output + AM/PM token into 24-hour hh/mm. */
function apply12HourSuffix(
  parts: { hh: number; mm: number; ss: number },
  suffix: string | null,
): { hh: number; mm: number; ss: number } | null {
  if (!suffix) return parts;
  const upper = suffix.toUpperCase();
  let { hh } = parts;
  if (hh < 1 || hh > 12) return null;
  if (upper === 'PM' && hh !== 12) hh += 12;
  if (upper === 'AM' && hh === 12) hh = 0;
  return { hh, mm: parts.mm, ss: parts.ss };
}

/**
 * Normalize a raw date-only value into `YYYY-MM-DD`. Returns null when the
 * input is blank or cannot be parsed with confidence.
 */
export function normalizeApiDate(raw: string | null | undefined): string | null {
  const parsed = parseAnyDate(raw);
  if (!parsed) return null;
  return formatYmd(parsed.date);
}

/**
 * Normalize a raw date or datetime value into `YYYY-MM-DD HH:mm:ss`. Date-only
 * inputs are expanded to `00:00:00`. Returns null when the input is blank or
 * cannot be parsed with confidence.
 */
export function normalizeApiDateTime(raw: string | null | undefined): string | null {
  const parsed = parseAnyDate(raw);
  if (!parsed) return null;
  return formatYmdHms(parsed.date);
}

/**
 * Normalize a raw time-of-day value into 24-hour `HH:mm`.
 *  - "14:30" / "14:30:45"  → "14:30"
 *  - "2:30 PM" / "2 pm"    → "14:30" / "14:00"
 *  - "0930" / "930"        → "09:30"
 *  - Excel fractional day  → time-of-day
 *
 * Returns null when the input is blank or cannot be parsed with confidence.
 */
export function normalizeApiTime(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed || isBlankDateToken(trimmed)) return null;

  // Excel fractional day (e.g. 0.5 → 12:00).
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    // If it's clearly a full serial (>=1 with an integer part), take the
    // fractional part as time-of-day.
    const frac = n - Math.trunc(n);
    if (n >= 1) {
      const totalSeconds = Math.round(frac * 86400);
      const hh = Math.floor(totalSeconds / 3600) % 24;
      const mm = Math.floor((totalSeconds % 3600) / 60);
      return `${pad2(hh)}:${pad2(mm)}`;
    }
    if (n >= 0 && n < 1) {
      const totalSeconds = Math.round(n * 86400);
      const hh = Math.floor(totalSeconds / 3600) % 24;
      const mm = Math.floor((totalSeconds % 3600) / 60);
      return `${pad2(hh)}:${pad2(mm)}`;
    }
    // Otherwise: treat bare integers as HHmm / HMM.
    if (n >= 0 && n < 2400) {
      const hh = Math.floor(n / 100);
      const mm = n % 100;
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${pad2(hh)}:${pad2(mm)}`;
    }
    return null;
  }

  // 12-hour form with AM/PM suffix.
  const ampm = trimmed.match(/^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*([AaPp][Mm])$/);
  if (ampm) {
    const parts = { hh: Number(ampm[1]), mm: ampm[2] ? Number(ampm[2]) : 0, ss: ampm[3] ? Number(ampm[3]) : 0 };
    const final = apply12HourSuffix(parts, ampm[4]);
    if (!final) return null;
    if (final.mm < 0 || final.mm > 59) return null;
    return `${pad2(final.hh)}:${pad2(final.mm)}`;
  }

  // 24-hour HH:mm[:ss]
  const colon = parseTimeTail(trimmed);
  if (colon) {
    if (colon.hh > 23 || colon.mm > 59 || colon.ss > 59) return null;
    return `${pad2(colon.hh)}:${pad2(colon.mm)}`;
  }

  // Compact numeric HHmm / HMM ("0930" / "930").
  const compact = trimmed.match(/^(\d{3,4})$/);
  if (compact) {
    const raw4 = compact[1].padStart(4, '0');
    const hh = Number(raw4.slice(0, 2));
    const mm = Number(raw4.slice(2));
    if (hh > 23 || mm > 59) return null;
    return `${pad2(hh)}:${pad2(mm)}`;
  }

  return null;
}
