import { useEffect, useRef, useState } from 'react';

import {
  CHAT_EMOJIS,
  CHAT_PRESETS,
  MAX_CHAT_LENGTH,
  type ChatInput,
  type ChatMessage,
} from '@shared/chat.ts';

import { initials } from '../lib/format.ts';
import { IconClose, IconSend } from './Icons.tsx';

interface ChatDockProps {
  open: boolean;
  messages: ChatMessage[];
  meId: string;
  onClose: () => void;
  onSend: (input: ChatInput) => void;
}

export default function ChatDock({ open, messages, meId, onClose, onSend }: ChatDockProps) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onSend({ kind: 'text', text: value });
    setText('');
  };

  return (
    <section
      className={`chat-dock ${open ? 'is-open' : ''}`}
      aria-label="Table chat"
      aria-hidden={!open}
    >
      <header className="chat-dock__head">
        <div className="chat-dock__heading">
          <span className="chat-dock__title">Table chat</span>
          <span className="chat-dock__sub">Quick phrases, reactions or your own words</span>
        </div>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close chat">
          <IconClose size={18} />
        </button>
      </header>

      <div className="chat-dock__log" ref={logRef} role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="chat-dock__empty">
            Say hello. Messages are not saved — they disappear when the room closes.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`chat-line chat-line--${message.color} ${
                message.playerId === meId ? 'is-me' : ''
              }`}
            >
              <span className={`chat-line__avatar chat-line__avatar--${message.color}`} aria-hidden="true">
                {initials(message.name)}
              </span>
              <div className="chat-line__body">
                <span className="chat-line__name">
                  {message.playerId === meId ? 'You' : message.name}
                </span>
                <span
                  className={`chat-line__text ${
                    message.kind === 'emoji' ? 'chat-line__text--emoji' : ''
                  }`}
                >
                  {message.text}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-dock__presets" aria-label="Quick phrases">
        {CHAT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="chat-chip"
            onClick={() => onSend({ kind: 'preset', presetId: preset.id })}
          >
            {preset.text}
          </button>
        ))}
      </div>

      <div className="chat-dock__emojis" aria-label="Emoji reactions">
        {CHAT_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="chat-emoji"
            onClick={() => onSend({ kind: 'emoji', emoji })}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <form className="chat-dock__form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="chat-dock__input"
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={MAX_CHAT_LENGTH}
          placeholder="Type a message…"
          aria-label="Chat message"
          autoComplete="off"
        />
        <button
          type="submit"
          className="chat-dock__send"
          disabled={!text.trim()}
          aria-label="Send message"
        >
          <IconSend size={18} />
        </button>
      </form>
    </section>
  );
}
