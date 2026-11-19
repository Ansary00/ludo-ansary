import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { FINAL_STEP } from '@shared/board.ts';
import type { Color, LogEntry } from '@shared/types.ts';

import Board from '../components/Board.tsx';
import Confetti from '../components/Confetti.tsx';
import Dice from '../components/Dice.tsx';
import { IconClock, IconSparkle, IconTrophy } from '../components/Icons.tsx';
import PlayerCard from '../components/PlayerCard.tsx';
import RoomTopBar from '../components/RoomTopBar.tsx';
import { useCountdown } from '../components/Toggle.tsx';
import { useTokenAnimation } from '../hooks/useTokenAnimation.ts';
import { COLOR_LABEL, initials, ordinal, plural } from '../lib/format.ts';
import type { RoomSession } from '../lib/session.tsx';
import { useSettings } from '../lib/settings.tsx';

function logText(entry: LogEntry, players: { color: Color; name: string }[]): string {
  const name = players.find((player) => player.color === entry.color)?.name ?? COLOR_LABEL[entry.color];
  switch (entry.type) {
    case 'roll':
      return `${name} rolled ${entry.dice}`;
    case 'move':
      return `${name} moved a token`;
    case 'capture': {
      const count = entry.captured?.length ?? 0;
      return `${name} captured ${count} token${count === 1 ? '' : 's'}`;
    }
    case 'finish':
      return `${name} brought a token home`;
    case 'pass':
      return `${name} had no legal move`;
    case 'forfeit':
      return `${name} lost the turn`;
    case 'start':
      return 'Game started';
    case 'end':
      return `${name} won the game`;
    default:
      return '';
  }
}

export default function GameView({ session, onExit }: { session: RoomSession; onExit: () => void }) {
  const navigate = useNavigate();
  const { settings, play } = useSettings();
  const snapshot = session.snapshot;
  const me = session.me;
  const game = snapshot?.game ?? null;
  const { tokens, ghosts } = useTokenAnimation(game);
  const [rolling, setRolling] = useState(false);

  const lastEvent = session.events[session.events.length - 1];
  const autoSeconds = useCountdown(snapshot?.autoPlayAt ?? null);

  useEffect(() => {
    if (lastEvent?.type !== 'rolled') return;
    setRolling(true);
    const timer = window.setTimeout(() => setRolling(false), 720);
    return () => window.clearTimeout(timer);
  }, [lastEvent]);

  const activeColor = game?.turnColor ?? null;
  const activePlayer = useMemo(
    () => (activeColor && snapshot ? snapshot.players.find((player) => player.color === activeColor) ?? null : null),
    [activeColor, snapshot],
  );
  const isMyTurn = Boolean(session.isMyTurn);
  const canRoll = Boolean(isMyTurn && game && game.dice === null);
  const movable = isMyTurn ? session.legalMoves : [];
  const finished = snapshot?.phase === 'finished';

  if (!snapshot || !game || !me) return null;

  const myTurnLabel = isMyTurn ? 'Your turn' : `${activePlayer?.name ?? 'Player'}'s turn`;
  const hint = (() => {
    if (finished) return 'Game over';
    if (!session.connected) return 'Reconnecting to the server…';
    if (isMyTurn) {
      if (game.dice === null) return 'Tap the dice to roll';
      if (movable.length === 0) return 'No legal move — passing…';
      return movable.length === 1 ? 'Move your highlighted token' : `Choose one of ${movable.length} moves`;
    }
    if (activePlayer && !activePlayer.connected) {
      return autoSeconds > 0 ? `Auto-play in ${autoSeconds}s` : 'Auto-playing…';
    }
    return `${activePlayer?.name ?? 'Player'} is thinking…`;
  })();

  const playersForLog = snapshot.players.map((player) => ({ color: player.color, name: player.name }));
  const logEntries = [...game.log].slice(-12).reverse();
  const durationMs = (game.finishedAt ?? Date.now()) - game.startedAt;

  const goHome = async () => {
    await session.leave();
    navigate('/');
  };

  return (
    <div className="game">
      <RoomTopBar code={snapshot.code} connected={session.connected} onExit={onExit} exitLabel="Exit game" />

      <main className="game__main">
        <aside className="game__players" aria-label="Players">
          {snapshot.players
            .slice()
            .sort((a, b) => a.seat - b.seat)
            .map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                color={player.color}
                isTurn={!finished && game.turnColor === player.color}
                isMe={player.id === me.id}
                tokensHome={game.tokens[player.color].filter((pos) => pos === FINAL_STEP).length}
                captures={game.stats[player.color].captures}
                autoPlayAt={snapshot.autoPlayAt}
              />
            ))}
        </aside>

        <section className="game__board-area">
          <div className={`game__banner ${isMyTurn ? 'is-mine' : ''}`} data-color={activeColor ?? undefined}>
            <span className="game__banner-dot" />
            <span className="game__banner-text">{finished ? 'Game over' : myTurnLabel}</span>
            <span className="game__banner-hint">{hint}</span>
            <span className="game__timer">
              <IconClock size={13} /> {Math.floor(durationMs / 60000)}:
              {String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0')}
            </span>
          </div>

          <Board
            tokens={tokens}
            activeColors={game.activeColors}
            currentTurn={finished ? null : game.turnColor}
            myColor={me.color}
            movable={movable}
            onTokenSelect={(_color, tokenId) => void session.move(tokenId)}
            ghosts={ghosts}
          />

          <div className="game__dock">
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
        </section>

        <aside className="game__side">
          <div className={`turn-card ${isMyTurn ? 'turn-card--mine' : ''}`} data-color={activeColor ?? undefined}>
            <p className="turn-card__eyebrow">
              <IconSparkle size={13} />
              {finished ? 'Final result' : isMyTurn ? 'Your move' : 'Now playing'}
            </p>
            <h2 className="turn-card__name">
              {finished ? 'Game over' : isMyTurn ? 'You' : activePlayer?.name ?? '—'}
              {!finished && activePlayer && (
                <span className={`turn-card__swatch turn-card__swatch--${activeColor}`} aria-hidden="true" />
              )}
            </h2>
            <p className="turn-card__state">
              {finished
                ? 'The board is settled.'
                : game.dice === null
                  ? 'Waiting for the dice…'
                  : `Rolled ${game.dice}${game.dice === 6 ? ' · extra turn' : ''}`}
            </p>
            <div className="turn-card__dice-wrap">
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

          <div className="card log-card">
            <header className="log-card__head">
              <h3>Match feed</h3>
              <span>{playersForLog.length} players</span>
            </header>
            <ul className="log">
              {logEntries.length === 0 && <li className="log__empty">The first roll is still to come.</li>}
              {logEntries.map((entry) => (
                <li key={entry.id} className={`log__item log__item--${entry.type}`}>
                  <span className={`log__dot log__dot--${entry.color}`} aria-hidden="true" />
                  <span className="log__text">{logText(entry, playersForLog)}</span>
                  <span className="log__time">
                    {Math.floor(Math.max(0, entry.at - game.startedAt) / 60000)}:
                    {String(Math.floor((Math.max(0, entry.at - game.startedAt) % 60000) / 1000)).padStart(2, '0')}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <details className="side-rules">
            <summary>Rules in play</summary>
            <ul>
              <li>Six to leave the base</li>
              <li>Exact roll to reach home</li>
              {snapshot.rules.extraTurnOnSix && <li>Extra turn on a six</li>}
              {snapshot.rules.extraTurnOnCapture && <li>Extra turn after a capture</li>}
              {snapshot.rules.extraTurnOnHome && <li>Extra turn on reaching home</li>}
              {snapshot.rules.threeSixesForfeit && <li>Three sixes loses the turn</li>}
              {snapshot.rules.captureOnSafe && <li>Captures allowed on safe squares</li>}
              {!snapshot.rules.captureOnSafe && <li>Safe squares protect tokens</li>}
            </ul>
          </details>
        </aside>
      </main>

      {finished && (
        <div className="result-overlay">
          <Confetti active={settings.animations} />
          <div className="result card" role="dialog" aria-modal="true" aria-label="Game result">
            <div className="result__badge">
              <IconTrophy size={34} />
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
              {Math.floor(durationMs / 60000)}m {Math.floor((durationMs % 60000) / 1000)}s ·{' '}
              {game.moveCount} token moves
            </p>

            <div className="result__actions">
              {session.isHost ? (
                <button type="button" className="btn btn--primary btn--lg" onClick={() => void session.rematch()}>
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
