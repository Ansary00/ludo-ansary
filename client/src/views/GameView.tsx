import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FINAL_STEP } from '@shared/board.ts';
import type { ChatInput } from '@shared/chat.ts';

import Board from '../components/Board.tsx';
import ChatDock from '../components/ChatDock.tsx';
import Confetti from '../components/Confetti.tsx';
import Dice from '../components/Dice.tsx';
import {
  IconChat,
  IconCheck,
  IconClock,
  IconCopy,
  IconDice,
  IconLogout,
  IconTrophy,
} from '../components/Icons.tsx';
import { Logo } from '../components/Logo.tsx';
import SettingsMenu from '../components/SettingsMenu.tsx';
import { useCountdown } from '../components/Toggle.tsx';
import { useTokenAnimation } from '../hooks/useTokenAnimation.ts';
import { COLOR_LABEL, initials, ordinal, plural } from '../lib/format.ts';
import type { RoomSession } from '../lib/session.tsx';
import { useSettings } from '../lib/settings.tsx';
import { copyText } from '../lib/share.ts';
import { useToast } from '../lib/toast.tsx';

function clock(ms: number): string {
  const safe = Math.max(0, ms);
  return `${Math.floor(safe / 60000)}:${String(Math.floor((safe % 60000) / 1000)).padStart(2, '0')}`;
}

export default function GameView({ session, onExit }: { session: RoomSession; onExit: () => void }) {
  const navigate = useNavigate();
  const { settings, play } = useSettings();
  const { push } = useToast();
  const snapshot = session.snapshot;
  const me = session.me;
  const game = snapshot?.game ?? null;
  const { tokens, ghosts } = useTokenAnimation(game);
  const [rolling, setRolling] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [burst, setBurst] = useState<{ id: string; emoji: string } | null>(null);
  const chatLengthRef = useRef(0);

  const lastEvent = session.events[session.events.length - 1];
  const autoSeconds = useCountdown(snapshot?.autoPlayAt ?? null);
  const finished = snapshot?.phase === 'finished';
  const lastChat = session.chat[session.chat.length - 1];

  useEffect(() => {
    if (lastEvent?.type !== 'rolled') return;
    setRolling(true);
    const timer = window.setTimeout(() => setRolling(false), 720);
    return () => window.clearTimeout(timer);
  }, [lastEvent]);

  useEffect(() => {
    if (finished) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    const previous = chatLengthRef.current;
    chatLengthRef.current = session.chat.length;
    if (session.chat.length <= previous) return;
    if (!chatOpen && lastChat?.playerId !== me?.id) {
      setUnread((count) => count + (session.chat.length - previous));
    }
  }, [session.chat, chatOpen, lastChat, me?.id]);

  useEffect(() => {
    if (lastChat?.kind !== 'emoji') return;
    setBurst({ id: lastChat.id, emoji: lastChat.emoji ?? lastChat.text });
  }, [lastChat]);

  useEffect(() => {
    if (!burst) return;
    const timer = window.setTimeout(() => setBurst(null), 2200);
    return () => window.clearTimeout(timer);
  }, [burst]);

  useEffect(() => {
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  const activeColor = game?.turnColor ?? null;
  const activePlayer = useMemo(
    () =>
      activeColor && snapshot
        ? snapshot.players.find((player) => player.color === activeColor) ?? null
        : null,
    [activeColor, snapshot],
  );
  const isMyTurn = Boolean(session.isMyTurn);
  const canRoll = Boolean(isMyTurn && game && game.dice === null);
  const movable = isMyTurn ? session.legalMoves : [];

  if (!snapshot || !game || !me) return null;

  const myTurnLabel = isMyTurn ? 'Your turn' : `${activePlayer?.name ?? 'Player'}'s turn`;
  const hint = (() => {
    if (finished) return 'Game over';
    if (!session.connected) return 'Reconnecting to the server…';
    if (isMyTurn) {
      if (game.dice === null) return 'Tap the dice to roll';
      if (movable.length === 0) return 'No legal move — passing…';
      return movable.length === 1
        ? 'Move your highlighted token'
        : `Choose one of ${movable.length} moves`;
    }
    if (activePlayer && !activePlayer.connected) {
      return autoSeconds > 0 ? `Auto-play in ${autoSeconds}s` : 'Auto-playing…';
    }
    return `${activePlayer?.name ?? 'Player'} is thinking…`;
  })();

  const durationMs = (game.finishedAt ?? now) - game.startedAt;
  const players = [...snapshot.players].sort((a, b) => a.seat - b.seat);

  const copyCode = async () => {
    const ok = await copyText(snapshot.code);
    if (!ok) return;
    setCopied(true);
    push('Room code copied.', 'success');
    window.setTimeout(() => setCopied(false), 1600);
  };

  const sendChat = (input: ChatInput) => {
    void session.sendChat(input);
  };

  const goHome = async () => {
    await session.leave();
    navigate('/');
  };

  return (
    <div className="game">
      <header className="play-bar">
        <div className="play-bar__left">
          <button type="button" className="icon-btn play-bar__exit" onClick={onExit} aria-label="Exit game">
            <IconLogout size={18} />
          </button>
          <span className="play-bar__brand">
            <Logo compact />
          </span>
          <button
            type="button"
            className={`play-bar__code ${copied ? 'is-copied' : ''}`}
            onClick={() => void copyCode()}
            title="Copy room code"
          >
            <span className="play-bar__code-label">Room</span>
            <strong>{snapshot.code}</strong>
            {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
          </button>
        </div>

        <div className="play-bar__chips" aria-label="Players">
          {players.map((player) => {
            const home = game.tokens[player.color].filter((pos) => pos === FINAL_STEP).length;
            const isTurn = !finished && game.turnColor === player.color;
            return (
              <span
                key={player.id}
                className={[
                  'player-chip',
                  `player-chip--${player.color}`,
                  isTurn ? 'is-turn' : '',
                  player.id === me.id ? 'is-me' : '',
                  player.connected ? '' : 'is-offline',
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={`${player.name} · ${home}/4 tokens home`}
              >
                <span className="player-chip__avatar" aria-hidden="true">
                  {initials(player.name)}
                </span>
                <span className="player-chip__meta">
                  <span className="player-chip__name">
                    {player.name}
                    {player.id === me.id && <em>you</em>}
                  </span>
                  <span className="player-chip__home">{home}/4 home</span>
                </span>
                {isTurn && (
                  <span className="player-chip__turn" aria-label="Their turn">
                    <IconDice size={12} />
                  </span>
                )}
              </span>
            );
          })}
        </div>

        <div className="play-bar__right">
          <button
            type="button"
            className={`chat-fab ${chatOpen ? 'is-active' : ''}`}
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? 'Close chat' : 'Open chat'}
            aria-expanded={chatOpen}
            title="Table chat"
          >
            <IconChat size={19} />
            {unread > 0 && !chatOpen && <span className="chat-fab__badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <SettingsMenu />
        </div>
      </header>

      <main className="game__table">
        <div className="game__stage">
          <div className="game__status" data-color={activeColor ?? undefined}>
            <span className="game__status-dot" aria-hidden="true" />
            <span className="game__status-text">{finished ? 'Game over' : myTurnLabel}</span>
            <span className="game__status-hint">{hint}</span>
            <span className="game__clock" aria-label="Game time">
              <IconClock size={12} /> {clock(durationMs)}
            </span>
          </div>

          <div className="game__board-shell">
            <Board
              tokens={tokens}
              activeColors={game.activeColors}
              currentTurn={finished ? null : game.turnColor}
              myColor={me.color}
              movable={movable}
              onTokenSelect={(_color, tokenId) => void session.move(tokenId)}
              ghosts={ghosts}
            />
            {burst && (
              <span key={burst.id} className="emoji-burst" aria-hidden="true">
                {burst.emoji}
              </span>
            )}
          </div>

          <div className={`game-controls ${isMyTurn ? 'is-mine' : ''}`} data-color={activeColor ?? undefined}>
            <div className="game-controls__who">
              <span
                className={`game-controls__swatch game-controls__swatch--${activeColor ?? 'red'}`}
                aria-hidden="true"
              />
              <span className="game-controls__text">
                <span className="game-controls__eyebrow">
                  {finished ? 'Final result' : isMyTurn ? 'Your move' : 'Now playing'}
                </span>
                <span className="game-controls__name">
                  {finished ? 'Game over' : isMyTurn ? 'You' : activePlayer?.name ?? '—'}
                </span>
                <span className="game-controls__state">
                  {finished
                    ? 'The board is settled.'
                    : game.dice === null
                      ? 'Waiting for the dice…'
                      : `Rolled ${game.dice}${game.dice === 6 ? ' · extra turn' : ''}`}
                </span>
              </span>
            </div>
            <Dice
              value={game.dice}
              rolling={rolling}
              canRoll={canRoll}
              onRoll={() => {
                setRolling(true);
                play('click');
                void session.roll();
              }}
              hint={hint}
            />
          </div>
        </div>
      </main>

      <ChatDock
        open={chatOpen}
        messages={session.chat}
        meId={me.id}
        onClose={() => setChatOpen(false)}
        onSend={sendChat}
      />

      {finished && (
        <div className="result-overlay">
          <Confetti active={settings.animations} />
          <div className="result card" role="dialog" aria-modal="true" aria-label="Game result">
            <div className="result__badge">
              <IconTrophy size={32} />
            </div>
            <p className="eyebrow">Game over</p>
            <h1>{snapshot.players.find((p) => p.color === game.winner)?.name ?? 'Winner'} wins!</h1>
            <p className="result__sub">
              {game.winner === me.color
                ? 'All four tokens home. Beautifully played.'
                : `${COLOR_LABEL[game.winner ?? 'red']} finished all four tokens first.`}
            </p>

            <ol className="result__list">
              {(game.rankings ?? []).map((ranking) => {
                const player = snapshot.players.find((p) => p.color === ranking.color);
                const isWinner = ranking.color === game.winner;
                return (
                  <li key={ranking.color} className={`result__row ${isWinner ? 'is-winner' : ''}`}>
                    <span className="result__rank">{ordinal(ranking.rank)}</span>
                    <span className={`result__avatar result__avatar--${ranking.color}`}>
                      {initials(player?.name ?? COLOR_LABEL[ranking.color])}
                    </span>
                    <span className="result__player">
                      <span className="result__player-name">
                        {player?.name ?? COLOR_LABEL[ranking.color]}
                        {ranking.color === me.color && <em> you</em>}
                      </span>
                      <span className="result__player-stats">
                        {ranking.tokensHome}/4 home · {plural(ranking.captures, 'capture')} ·{' '}
                        {plural(ranking.sixes, 'six', 'sixes')}
                      </span>
                    </span>
                    {isWinner && <IconTrophy size={18} className="result__trophy" />}
                  </li>
                );
              })}
            </ol>

            <p className="result__meta">
              {clock(durationMs)} · {game.moveCount} token moves
            </p>

            <div className="result__actions">
              {session.isHost ? (
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => void session.rematch()}
                >
                  Play again
                </button>
              ) : (
                <p className="result__waiting">Waiting for the host to start a rematch…</p>
              )}
              <button type="button" className="btn btn--ghost btn--lg" onClick={() => void goHome()}>
                Back to home
              </button>
            </div>
            <p className="result__note">A rematch keeps every seat if all players are still connected.</p>
          </div>
        </div>
      )}
    </div>
  );
}
