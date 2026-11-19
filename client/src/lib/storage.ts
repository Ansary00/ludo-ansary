export interface SeatRecord {
  playerId: string;
  secret: string;
  name: string;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  animations: boolean;
  name: string;
}

const SETTINGS_KEY = 'ludo-ansary:settings:v1';
const SEAT_PREFIX = 'ludo-ansary:seat:';

const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: false,
  animations: true,
  name: '',
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode / quota: settings are a nice-to-have, never break the game.
  }
}

export function loadSettings(): Settings {
  const stored = readJson<Partial<Settings>>(SETTINGS_KEY);
  return {
    sound: typeof stored?.sound === 'boolean' ? stored.sound : DEFAULT_SETTINGS.sound,
    music: typeof stored?.music === 'boolean' ? stored.music : DEFAULT_SETTINGS.music,
    animations: typeof stored?.animations === 'boolean' ? stored.animations : DEFAULT_SETTINGS.animations,
    name: typeof stored?.name === 'string' ? stored.name.slice(0, 16) : DEFAULT_SETTINGS.name,
  };
}

export function saveSettings(settings: Settings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadSeat(code: string): SeatRecord | null {
  const seat = readJson<SeatRecord>(`${SEAT_PREFIX}${code}`);
  if (!seat || typeof seat.secret !== 'string' || typeof seat.playerId !== 'string') return null;
  return seat;
}

export function saveSeat(code: string, seat: SeatRecord): void {
  writeJson(`${SEAT_PREFIX}${code}`, seat);
}

export function clearSeat(code: string): void {
  try {
    localStorage.removeItem(`${SEAT_PREFIX}${code}`);
  } catch {
    // ignore
  }
}

export function rememberName(name: string): void {
  const settings = loadSettings();
  saveSettings({ ...settings, name });
}
