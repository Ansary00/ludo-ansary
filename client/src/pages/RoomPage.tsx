import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import { IconArrowRight, IconHome, IconSparkle } from '../components/Icons.tsx';
import { Logo } from '../components/Logo.tsx';
import Modal from '../components/Modal.tsx';
import SettingsMenu from '../components/SettingsMenu.tsx';
import { useRoomSession, type RoomSession } from '../lib/session.tsx';
import GameView from '../views/GameView.tsx';
import JoinRoomView from '../views/JoinRoomView.tsx';
import LobbyView from '../views/LobbyView.tsx';

function RoomLoading({ code }: { code: string }) {
  return (
    <div className="room-loading">
      <Logo />
      <div className="spinner" aria-hidden="true" />
      <p>Opening room {code || '…'}</p>
    </div>
  );
}

const ERROR_COPY: Record<string, { title: string; body: string }> = {
  'room-not-found': {
    title: 'Room not found',
    body: 'This invitation link is invalid or the room has expired. Rooms are deleted after 30 minutes of inactivity.',
  },
  'room-full': {
    title: 'This room is full',
    body: 'Every seat is taken. Ask the host to free a seat, or create your own room and invite them back.',
  },
  'game-in-progress': {
    title: 'Game already in progress',
    body: 'A match is running in this room. You can only join a room before the host starts the game.',
  },
  'room-closed': {
    title: 'Room closed',
    body: 'This room is no longer available. Create a fresh room and share the new link.',
  },
  'session-replaced': {
    title: 'Seat opened in another tab',
    body: 'This player seat is now active in another browser tab or device. Use that tab to continue playing.',
  },
  offline: {
    title: 'Server unreachable',
    body: 'We could not reach the game server. Check your internet connection and try again.',
  },
  timeout: {
    title: 'Server timed out',
    body: 'The game server did not answer in time. Try again in a moment.',
  },
  'unknown-seat': {
    title: 'Seat unavailable',
    body: 'Your saved seat is no longer part of this room. Joining again may fill a new seat if one is free.',
  },
};

function RoomErrorView({ session }: { session: RoomSession }) {
  const error = session.error ?? { code: 'unknown', message: 'Something went wrong.' };
  const copy = ERROR_COPY[error.code] ?? { title: 'Unable to open room', body: error.message };

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
        <div className="card form-card form-card--centered error-card">
          <span className="error-card__icon">
            <IconSparkle />
          </span>
          <p className="eyebrow">Room {session.code}</p>
          <h1>{copy.title}</h1>
          <p className="form-card__lede">{copy.body}</p>
          <div className="button-row button-row--center">
            <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
              Try again
            </button>
            <Link to="/create" className="btn btn--ghost">
              Create a room
            </Link>
            <Link to="/" className="btn btn--ghost">
              <IconHome size={16} /> Home
            </Link>
          </div>
          {error.code === 'room-not-found' && (
            <p className="form-note">
              Joined by invitation? Ask the host to resend the link — codes are case insensitive.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function RoomSessionPage({ code }: { code: string }) {
  const session = useRoomSession(code);
  const navigate = useNavigate();
  const [exitOpen, setExitOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const phase = session.snapshot?.phase;
  useEffect(() => {
    if (!phase) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [phase]);

  const confirmExit = async () => {
    setLeaving(true);
    await session.leave();
    setLeaving(false);
    setExitOpen(false);
    navigate('/');
  };

  if (session.status === 'loading') return <RoomLoading code={code} />;
  if (session.status === 'needs-name') return <JoinRoomView session={session} />;
  if (session.status === 'error' || !session.snapshot) return <RoomErrorView session={session} />;

  const inGame = session.snapshot.phase !== 'lobby';

  return (
    <>
      {!session.connected && (
        <div className="conn-banner" role="status">
          <span className="conn-banner__spinner" aria-hidden="true" />
          Connection lost — reconnecting your seat…
        </div>
      )}

      {inGame ? (
        <GameView session={session} onExit={() => setExitOpen(true)} />
      ) : (
        <LobbyView session={session} onExit={() => setExitOpen(true)} />
      )}

      <Modal
        open={exitOpen}
        title={inGame ? 'Exit this game?' : 'Leave this room?'}
        onClose={() => setExitOpen(false)}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setExitOpen(false)}>
              Stay
            </button>
            <button type="button" className="btn btn--danger" onClick={() => void confirmExit()} disabled={leaving}>
              {leaving ? 'Leaving…' : inGame ? 'Exit game' : 'Leave room'}
            </button>
          </>
        }
      >
        {inGame ? (
          <p>
            Your seat stays reserved so you can rejoin from this link. While you are away, the server
            will auto-play your turns after a short delay. If you are the host, the host role passes to
            another connected player.
          </p>
        ) : (
          <p>Your seat will be released immediately and another friend can take it.</p>
        )}
        <p className="modal__hint">
          <IconArrowRight size={14} /> You can always come back using the invite link.
        </p>
      </Modal>
    </>
  );
}

export default function RoomPage() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <Navigate to="/join" replace />;
  return <RoomSessionPage code={code} />;
}
