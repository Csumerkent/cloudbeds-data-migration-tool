export interface AppDateTimeSettings {
  useSystemDateTime: boolean;
  manualDateTime: string | null;
  timezone: 'Europe/Istanbul';
}

const STORAGE_KEY = 'cloudbeds-app-datetime-settings';
const DEFAULT_TIMEZONE = 'Europe/Istanbul';

function getDefaultSettings(): AppDateTimeSettings {
  return {
    useSystemDateTime: true,
    manualDateTime: null,
    timezone: DEFAULT_TIMEZONE,
  };
}

export function loadAppDateTimeSettings(): AppDateTimeSettings {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return getDefaultSettings();

  try {
    const parsed = JSON.parse(raw) as Partial<AppDateTimeSettings>;
    return {
      useSystemDateTime: parsed.useSystemDateTime ?? true,
      manualDateTime: typeof parsed.manualDateTime === 'string' ? parsed.manualDateTime : null,
      timezone: DEFAULT_TIMEZONE,
    };
  } catch {
    return getDefaultSettings();
  }
}

export function saveAppDateTimeSettings(settings: AppDateTimeSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    useSystemDateTime: settings.useSystemDateTime,
    manualDateTime: settings.manualDateTime,
    timezone: DEFAULT_TIMEZONE,
  }));
}

export function isUsingSystemDateTime(): boolean {
  return loadAppDateTimeSettings().useSystemDateTime;
}

export function getConfiguredManualDateTime(): string | null {
  return loadAppDateTimeSettings().manualDateTime;
}

export function getCurrentAppDateTime(): Date {
  const settings = loadAppDateTimeSettings();
  if (settings.useSystemDateTime) {
    return new Date();
  }

  if (settings.manualDateTime) {
    const parsed = new Date(settings.manualDateTime);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

export function formatAppDateTimeForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatAppDateTimeForLog(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: DEFAULT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;

  const millis = String(date.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${millis}`;
}
