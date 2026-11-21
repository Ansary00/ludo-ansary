import type { Color } from './types.ts';

/**
 * Chat shared between client and server.
 *
 * Preset ids and emoji are a whitelist: the server resolves the text itself and
 * never trusts text sent by the client for presets or reactions.
 */

export const CHAT_PRESETS = [
  { id: 'nice', text: 'Nice move!' },
  { id: 'good', text: 'Good move!' },
  { id: 'lucky', text: 'So lucky!' },
  { id: 'six', text: 'Need a six!' },
  { id: 'oops', text: 'Oops!' },
  { id: 'wow', text: 'Wow!' },
  { id: 'gg', text: 'Good game!' },
  { id: 'hurry', text: 'Your turn!' },
  { id: 'thanks', text: 'Thanks!' },
  { id: 'wellplayed', text: 'Well played!' },
] as const;

export type ChatPresetId = (typeof CHAT_PRESETS)[number]['id'];

export const CHAT_PRESETS_BY_ID: Record<string, string> = Object.fromEntries(
  CHAT_PRESETS.map((preset) => [preset.id, preset.text]),
);

export const CHAT_EMOJIS = [
  '😀',
  '😂',
  '😍',
  '😎',
  '🤔',
  '😱',
  '😭',
  '😡',
  '👍',
  '👏',
  '🙌',
  '🔥',
  '🎲',
  '🎉',
  '💀',
  '🤝',
] as const;

export const CHAT_EMOJI_SET: ReadonlySet<string> = new Set(CHAT_EMOJIS);

export const MAX_CHAT_LENGTH = 120;

export type ChatKind = 'preset' | 'emoji' | 'text';

export interface ChatInput {
  kind: ChatKind;
  presetId?: string;
  emoji?: string;
  text?: string;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  color: Color;
  kind: ChatKind;
  /** Resolved, sanitized text to display. */
  text: string;
  /** Set for emoji reactions so the board can show a burst. */
  emoji?: string;
  presetId?: string;
  at: number;
}

export interface ChatContent {
  kind: ChatKind;
  text: string;
  emoji?: string;
  presetId?: string;
}

export type ChatBuildResult =
  | { ok: true; content: ChatContent }
  | { ok: false; code: string; message: string };

/*
 * Free-text moderation.
 *
 * Normalise case, accents and common leetspeak, then match whole tokens so a
 * harmless word such as "class" never trips the "ass" entry.
 */
const BLOCKED_WORDS = [
  'ass',
  'asshole',
  'bastard',
  'bitch',
  'bullshit',
  'cunt',
  'dick',
  'dickhead',
  'fag',
  'faggot',
  'fuck',
  'fucking',
  'motherfucker',
  'nigga',
  'nigger',
  'penis',
  'porn',
  'pussy',
  'rape',
  'retard',
  'sex',
  'shit',
  'slut',
  'twat',
  'vagina',
  'whore',
];

const BLOCKED_PHRASES = ['kill yourself', 'kys'];

function squash(value: string): string {
  return value.replace(/(.)\1+/g, '$1');
}

const BLOCKED_SQUASHED: ReadonlySet<string> = new Set(BLOCKED_WORDS.map(squash));

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/0/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[7+]/g, 't')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsProfanity(value: string): boolean {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (BLOCKED_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
  return normalized
    .split(' ')
    .filter(Boolean)
    .some((token) => BLOCKED_SQUASHED.has(squash(token)));
}

/** Strip control/HTML characters, collapse whitespace and cap the length. */
export function sanitizeChatText(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(cleaned).slice(0, MAX_CHAT_LENGTH).join('');
}

export function buildChatContent(input: ChatInput | null | undefined): ChatBuildResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, code: 'chat-invalid', message: 'That message could not be sent.' };
  }

  if (input.kind === 'preset') {
    const id = typeof input.presetId === 'string' ? input.presetId : '';
    const text = CHAT_PRESETS_BY_ID[id];
    if (!text) return { ok: false, code: 'chat-invalid', message: 'Unknown quick phrase.' };
    return { ok: true, content: { kind: 'preset', presetId: id, text } };
  }

  if (input.kind === 'emoji') {
    const emoji = typeof input.emoji === 'string' ? input.emoji : '';
    if (!CHAT_EMOJI_SET.has(emoji)) {
      return { ok: false, code: 'chat-invalid', message: 'That reaction is not available.' };
    }
    return { ok: true, content: { kind: 'emoji', emoji, text: emoji } };
  }

  if (input.kind === 'text') {
    const text = sanitizeChatText(input.text);
    if (!text) return { ok: false, code: 'chat-empty', message: 'Type a message first.' };
    if (containsProfanity(text)) {
      return { ok: false, code: 'chat-blocked', message: 'That message contains blocked words.' };
    }
    return { ok: true, content: { kind: 'text', text } };
  }

  return { ok: false, code: 'chat-invalid', message: 'That message could not be sent.' };
}
