import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_CHAT_LENGTH,
  buildChatContent,
  containsProfanity,
  sanitizeChatText,
} from '../shared/src/chat.ts';

test('chat content resolves presets and validates emoji on the server', () => {
  const preset = buildChatContent({ kind: 'preset', presetId: 'nice', text: 'ignored' });
  assert.equal(preset.ok, true);
  if (preset.ok) {
    assert.equal(preset.content.text, 'Nice move!');
    assert.equal(preset.content.presetId, 'nice');
    assert.equal(preset.content.kind, 'preset');
  }

  assert.equal(buildChatContent({ kind: 'preset', presetId: 'unknown' }).ok, false);

  const emoji = buildChatContent({ kind: 'emoji', emoji: '🎲' });
  assert.equal(emoji.ok, true);
  if (emoji.ok) assert.equal(emoji.content.emoji, '🎲');

  assert.equal(buildChatContent({ kind: 'emoji', emoji: '💩' }).ok, false);
  assert.equal(buildChatContent({ kind: 'nope' as 'text' }).ok, false);
});

test('free text is sanitized, capped and moderated without false positives', () => {
  assert.equal(sanitizeChatText('<b>Hello</b>\u0000  world'), 'Hello world');
  assert.equal(sanitizeChatText('x'.repeat(300)).length, MAX_CHAT_LENGTH);

  for (const blocked of [
    'what the fuck',
    'fuuuck this',
    'you a55hole',
    'total bullsh1t',
    'you are an ass',
    'kill yourself',
  ]) {
    assert.equal(containsProfanity(blocked), true, blocked);
  }

  for (const clean of [
    'as soon as possible',
    'the class assignment passed',
    'look at that skyscraper',
    'the assassin moved quietly',
    'pass the dice, please',
  ]) {
    assert.equal(containsProfanity(clean), false, clean);
  }

  const empty = buildChatContent({ kind: 'text', text: '   ' });
  assert.equal(empty.ok, false);
  assert.equal(empty.ok === false && empty.code, 'chat-empty');

  const blocked = buildChatContent({ kind: 'text', text: 'what the fuck' });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.ok === false && blocked.code, 'chat-blocked');
});
