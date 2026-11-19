import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { JoinResult, PeekInfo } from '@shared/protocol.ts';

import { IconArrowLeft, IconArrowRight, IconUsers } from '../components/Icons.tsx';
import { Logo } from '../components/Logo.tsx';
import SettingsMenu from '../components/SettingsMenu.tsx';
import { COLOR_LABEL, initials } from '../lib/format.ts';
import { request } from '../lib/socket.ts';
import { loadSeat, saveSeat } from '../lib/storage.ts';
import { useSettings } from '../lib/settings.tsx';

export default function JoinPage() {
  const params = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const { settings, rememberName } = useSettings();
  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [name, setName] = useState(settings.name);
  const [peek, setPeek] = useState<PeekInfo | null>(null);
  const [loadingPeek, setLoadingPeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (code.length < 4) {
      setPeek(null);
      setLoadingPeek(false);
      return;
    }
    let cancelled = false;
    setLoadingPeek(true);
    const timer = window.setTimeout(async () => {
      const response = await request<PeekInfo>('room:peek', { code }, 6000);
      if (cancelled) return;
      setLoadingPeek(false);
      if (response.ok) setPeek(response.data);
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName || code.length < 4 || busy) return;
    setError(null);

    if (loadSeat(code)) {
      navigate(`/room/${code}`, { replace: true });
      return;
    }

    setBusy(true);
    const response = await request<JoinResult>('room:join', { code, name: cleanName });
    setBusy(false);
    if (!response.ok) {
      setError(response.error.message);
      return;
    }
    saveSeat(code, { playerId: response.data.playerId, secret: response.data.secret, name: cleanName });
    rememberName(cleanName);
    navigate(`/room/${code}`, { replace: true });
  };

  const roomOpen = peek?.exists && peek.phase === 'lobby' && peek.takenSeats < peek.maxPlayers;

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

      <main className="form-wrap form-wrap--narrow">
        <Link to="/" className="back-link">
          <IconArrowLeft size={16} /> Back to home
        </Link>

        <form className="card form-card" onSubmit={submit}>
          <h1>Join a room</h1>
          <p className="form-card__lede">Enter the six-character code your friend shared with you.</p>

          <label className="field">
            <span className="field__label">Room code</span>
            <input
              className="input input--code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="ABC123"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              autoFocus={!params.code}
            />
          </label>

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

          {loadingPeek && <p className="form-note">Checking room…</p>}

          {!loadingPeek && code.length >= 4 && peek && (
            <div className={`room-peek ${roomOpen ? 'is-open' : 'is-closed'}`}>
              {peek.exists ? (
                <>
                  <div className="room-peek__head">
                    <span className="room-peek__code">{peek.code}</span>
                    <span className="pill">
                      <IconUsers size={11} /> {peek.takenSeats}/{peek.maxPlayers}
                    </span>
                  </div>
                  <ul className="room-peek__players">
                    {peek.players.map((player) => (
                      <li key={player.name}>
                        <span className={`room-peek__dot room-peek__dot--${player.color}`}>
                          {initials(player.name)}
                        </span>
                        <span>{player.name}</span>
                        <span className="room-peek__color">{COLOR_LABEL[player.color]}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="room-peek__status">
                    {peek.phase !== 'lobby'
                      ? 'A game is already in progress in this room.'
                      : roomOpen
                        ? `${peek.maxPlayers - peek.takenSeats} seat(s) available — you can join.`
                        : 'This room is full.'}
                  </p>
                </>
              ) : (
                <p className="room-peek__status">No room exists with this code. Double-check the invite link.</p>
              )}
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn--primary btn--lg btn--block"
            disabled={busy || code.trim().length < 4 || !name.trim()}
          >
            {busy ? 'Joining…' : 'Join room'}
            {!busy && <IconArrowRight size={18} />}
          </button>

          <p className="form-note">
            No account needed. Your name is stored only in this browser and this game room.
          </p>
        </form>

        <p className="form-footnote">
          Want to host instead? <Link to="/create">Create a private room</Link>
        </p>
      </main>
    </div>
  );
}
