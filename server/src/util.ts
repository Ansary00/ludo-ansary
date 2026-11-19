import { randomBytes, randomInt } from 'node:crypto';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;
export const MAX_NAME_LENGTH = 16;

export function generateRoomCode(length = ROOM_CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return code;
}

export function randomId(): string {
  return randomBytes(9).toString('base64url');
}

export function randomSecret(): string {
  return randomBytes(24).toString('base64url');
}

export function rollDie(): number {
  return randomInt(1, 7);
}

/** Trim, strip control/HTML characters and cap the length. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const chars = [...cleaned];
  const capped = chars.slice(0, MAX_NAME_LENGTH).join('').trim();
  return capped || null;
}

export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 4 || cleaned.length > 8) return null;
  return cleaned;
}

/** Tiny fixed-window rate limiter (in-memory, per-process). */
export class RateLimiter {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  allow(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    if (bucket.count >= this.limit) return false;
    bucket.count += 1;
    return true;
  }

  sweep(now = Date.now()): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  forget(key: string): void {
    this.buckets.delete(key);
  }
}

export function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}
