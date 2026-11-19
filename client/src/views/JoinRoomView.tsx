import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { IconArrowLeft, IconArrowRight, IconUsers } from '../components/Icons.tsx';
import { Logo } from '../components/Logo.tsx';
import type { RoomSession } from '../lib/session.tsx';
import { useSettings } from '../lib/settings.tsx';

export default function JoinRoomView({ session }: { session: RoomSession }) {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [name, setName] = useState(settings.name);
  const [error, setError] = useState<string | null>(null);
  const peek = session.peek;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Please enter a display name.');
      return;
    }
    setError(null);
    const joined = await session.join(name.trim());
    if (!joined) setError('Could not join this room.');
  };

  return (
    <div className="page page--form">
      <header className="site-header site-header--simple">
        <div className="site-header__inner">
          <Logo />
        </div>
      </header>

      <main className="form-wrap form-wrap--narrow">
        <Link to="/" className="back-link">
          <IconArrowLeft size={16} /> Back to home
        </Link>

        <form className="card form-card" onSubmit={submit}>
          <p className="eyebrow">Invitation</p>
          <h1>Join room {session.code}</h1>
          <p className="form-card__lede">
            {peek
              ? `${peek.takenSeats} of ${peek.maxPlayers} seats taken. Enter a name to take your place at the board.`
              : 'Enter a name to take your place at the board.'}
          </p>

          {peek && peek.players.length > 0 && (
            <ul className="join-players">
              {peek.players.map((player) => (
                <li key={player.name}>
                  <span className={`join-players__dot join-players__dot--${player.color}`} />
                  <span>{player.name}</span>
                  {player.connected ? (
                    <span className="join-players__status">in the room</span>
                  ) : (
                    <span className="join-players__status is-offline">away</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <label className="field">
            <span className="field__label">Your display name</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 16))}
              placeholder="e.g. Mahi"
              maxLength={16}
              autoFocus
              autoComplete="nickname"
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={session.busy}>
            {session.busy ? 'Joining…' : 'Join game'}
            {!session.busy && <IconArrowRight size={18} />}
          </button>
          <p className="form-note">
            <IconUsers size={14} /> Only people with the room link can see this lobby.
          </p>
        </form>

        <p className="form-footnote">
          Room not working?{' '}
          <button type="button" className="link-btn" onClick={() => navigate('/join')}>
            Try another code
          </button>
        </p>
      </main>
    </div>
  );
}
