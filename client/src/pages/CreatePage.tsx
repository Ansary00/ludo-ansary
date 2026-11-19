import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { colorsForRoomSize } from '@shared/board.ts';
import type { JoinResult } from '@shared/protocol.ts';
import { DEFAULT_RULES, type Rules } from '@shared/types.ts';

import {
  IconArrowLeft,
  IconArrowRight,
  IconCrown,
  IconSparkle,
  IconUsers,
} from '../components/Icons.tsx';
import { Logo } from '../components/Logo.tsx';
import SettingsMenu from '../components/SettingsMenu.tsx';
import Toggle from '../components/Toggle.tsx';
import { COLOR_LABEL } from '../lib/format.ts';
import { request } from '../lib/socket.ts';
import { saveSeat } from '../lib/storage.ts';
import { useSettings } from '../lib/settings.tsx';
import { useToast } from '../lib/toast.tsx';

const RULE_COPY: { key: keyof Rules; title: string; text: string }[] = [
  { key: 'extraTurnOnSix', title: 'Extra turn on a six', text: 'Rolling a six lets you move, then roll again.' },
  { key: 'extraTurnOnCapture', title: 'Extra turn after a capture', text: 'Sending an opponent home rewards you with another roll.' },
  { key: 'extraTurnOnHome', title: 'Extra turn for reaching home', text: 'Bringing a token to the centre grants another roll.' },
  { key: 'threeSixesForfeit', title: 'Three sixes loses the turn', text: 'Rolling three sixes in a row ends your turn immediately.' },
  { key: 'captureOnSafe', title: 'Captures on safe squares', text: 'Allow captures on start and star squares. Off by default.' },
];

export default function CreatePage() {
  const navigate = useNavigate();
  const { settings, rememberName } = useSettings();
  const { push } = useToast();
  const [name, setName] = useState(settings.name);
  const [size, setSize] = useState(2);
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const colors = colorsForRoomSize(size);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const clean = name.trim();
    if (!clean) {
      setError('Please enter a display name.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const response = await request<JoinResult>('room:create', {
      name: clean,
      maxPlayers: size,
      rules,
    });
    setSubmitting(false);
    if (!response.ok) {
      setError(response.error.message);
      push(response.error.message, 'error');
      return;
    }
    const { data } = response;
    saveSeat(data.snapshot.code, {
      playerId: data.playerId,
      secret: data.secret,
      name: clean,
    });
    rememberName(clean);
    navigate(`/room/${data.snapshot.code}`, { replace: true });
  };

  return (
    <div className="page page--form">
      <header className="site-header site-header--simple">
        <div className="site-header__inner">
          <Logo />
          <div className="site-header__nav">
            <SettingsMenu />
          </div>
        </div>
      </header>

      <main className="form-wrap">
        <Link to="/" className="back-link">
          <IconArrowLeft size={16} /> Back to home
        </Link>

        <div className="form-layout">
          <form className="card form-card" onSubmit={submit}>
            <p className="eyebrow">
              <IconSparkle size={14} /> New private room
            </p>
            <h1>Set the table</h1>
            <p className="form-card__lede">
              Choose how many players you need and share the invite link once the room is open.
            </p>

            <label className="field">
              <span className="field__label">Your display name</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value.slice(0, 16))}
                placeholder="e.g. Mahi"
                maxLength={16}
                autoComplete="nickname"
              />
            </label>

            <fieldset className="field">
              <legend className="field__label">Number of players</legend>
              <div className="seat-picker" role="radiogroup" aria-label="Number of players">
                {[2, 3, 4].map((count) => (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={size === count}
                    className={`seat-picker__option ${size === count ? 'is-active' : ''}`}
                    onClick={() => setSize(count)}
                  >
                    <span className="seat-picker__dots" aria-hidden="true">
                      {colorsForRoomSize(count).map((color) => (
                        <span key={color} className={`seat-dot seat-dot--${color}`} />
                      ))}
                    </span>
                    <span className="seat-picker__label">{count} players</span>
                    <span className="seat-picker__meta">
                      {colorsForRoomSize(count).map((color) => COLOR_LABEL[color]).join(' · ')}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <details className="rules">
              <summary>
                <span>House rules</span>
                <span className="rules__summary">Optional · default classic</span>
              </summary>
              <div className="rules__list">
                {RULE_COPY.map((rule) => (
                  <div key={rule.key} className="rule-row">
                    <span className="rule-row__text">
                      <span className="rule-row__title">{rule.title}</span>
                      <span className="rule-row__desc">{rule.text}</span>
                    </span>
                    <Toggle
                      checked={rules[rule.key]}
                      onChange={(value) => setRules((current) => ({ ...current, [rule.key]: value }))}
                      label={rule.title}
                    />
                  </div>
                ))}
              </div>
            </details>

            {error && <p className="form-error">{error}</p>}

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting}>
              {submitting ? 'Creating room…' : 'Create room'}
              {!submitting && <IconArrowRight size={18} />}
            </button>
            <p className="form-note">
              You will be the host. Rooms are private — only people with the link can join.
            </p>
          </form>

          <aside className="form-aside">
            <div className="card preview-card">
              <p className="preview-card__label">Seats in this room</p>
              <ul className="preview-seats">
                {colors.map((color, index) => (
                  <li key={color} className="preview-seat">
                    <span className={`preview-seat__avatar preview-seat__avatar--${color}`}>
                      {index === 0 ? 'You' : '?'}
                    </span>
                    <span className="preview-seat__text">
                      <span className="preview-seat__name">
                        {index === 0 ? name.trim() || 'You' : `Player ${index + 1}`}
                      </span>
                      <span className="preview-seat__color">{COLOR_LABEL[color]} tokens</span>
                    </span>
                    {index === 0 ? (
                      <span className="pill pill--gold">
                        <IconCrown size={11} /> Host
                      </span>
                    ) : (
                      <span className="pill">Open</span>
                    )}
                  </li>
                ))}
              </ul>
              <hr className="divider" />
              <p className="preview-card__hint">
                <IconUsers size={15} /> The game starts when every seat is filled and each guest taps
                “Ready”.
              </p>
            </div>
            <div className="card tip-card">
              <h3>Inviting friends</h3>
              <p>
                After creating the room you will get a six-character code and a link like
                <code> /room/ABC123</code>. Send it in any chat app — it opens the board directly.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
