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
// Date / time
// ===========================================================================

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function excelSerialToDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const wholeDays = Math.floor(serial);
  if (wholeDays <= 0) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const milliseconds = wholeDays * 86400000;
  const timeFraction = serial - wholeDays;
  return new Date(epoch + milliseconds + Math.round(timeFraction * 86400000));
}

function parseSlashDate(raw: string): { year: number; month: number; day: number } | null {
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);

  if (first > 12 && second <= 12) {
    return isValidDateParts(year, second, first) ? { year, month: second, day: first } : null;
  }
  if (second > 12 && first <= 12) {
    return isValidDateParts(year, first, second) ? { year, month: first, day: second } : null;
  }
  if (first > 12 || second > 12 || first === second) {
    return null;
  }
  return null;
}

function formatDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function formatDateTime(date: Date): string {
  return date.toISOString();
}

function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateLike(raw: string | number | null | undefined): Date | null {
  if (raw == null) return null;

  if (typeof raw === 'number') {
    return excelSerialToDate(raw);
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return excelSerialToDate(Number(trimmed));
  }

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  const isoDateTime = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (isoDateTime) {
    const year = Number(isoDateTime[1]);
    const month = Number(isoDateTime[2]);
    const day = Number(isoDateTime[3]);
    const hour = Number(isoDateTime[4]);
    const minute = Number(isoDateTime[5]);
    const second = Number(isoDateTime[6] ?? '0');
    if (!isValidDateParts(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  const slashDate = parseSlashDate(trimmed);
  if (slashDate) {
    return new Date(Date.UTC(slashDate.year, slashDate.month - 1, slashDate.day));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeApiDate(raw: string | number | null | undefined): string | null {
  const parsed = parseDateLike(raw);
  return parsed ? formatDate(parsed) : null;
}

export function normalizeApiDateTime(raw: string | number | null | undefined): string | null {
  const parsed = parseDateLike(raw);
  return parsed ? formatDateTime(parsed) : null;
}

export function normalizeApiTime(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;

  if (typeof raw === 'number') {
    const hours = Math.floor(raw * 24);
    const minutes = Math.round((raw * 24 - hours) * 60);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return `${pad(hours)}:${pad(minutes)}:00`;
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return null;

  const direct = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (direct) {
    const hour = Number(direct[1]);
    const minute = Number(direct[2]);
    const second = Number(direct[3] ?? '0');
    if (hour > 23 || minute > 59 || second > 59) return null;
    return `${pad(hour)}:${pad(minute)}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : formatTime(parsed);
}
