import { useEffect } from 'react';

import { colorsForRoomSize } from '@shared/board.ts';
import type { Rules } from '@shared/types.ts';

import { IconBolt, IconCheck, IconCrown, IconShare, IconUsers } from '../components/Icons.tsx';
import PlayerCard from '../components/PlayerCard.tsx';
import RoomTopBar from '../components/RoomTopBar.tsx';
import ShareRow from '../components/ShareRow.tsx';
import { COLOR_LABEL } from '../lib/format.ts';
import type { RoomSession } from '../lib/session.tsx';
import { useSettings } from '../lib/settings.tsx';

const RULE_LABELS: { key: keyof Rules; label: string }[] = [
  { key: 'extraTurnOnSix', label: 'Extra turn on 6' },
  { key: 'extraTurnOnCapture', label: 'Extra turn on capture' },
  { key: 'extraTurnOnHome', label: 'Extra turn on home' },
  { key: 'threeSixesForfeit', label: 'Three 6s = lose turn' },
  { key: 'captureOnSafe', label: 'Capture on safe cells' },
];

export default function LobbyView({ session, onExit }: { session: RoomSession; onExit: () => void }) {
  const { snapshot, me, isHost, connected } = session;
  const { play } = useSettings();

  useEffect(() => {
    if (snapshot && snapshot.players.length > 1) play('join');
    // Play a subtle cue once when the lobby gains a player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.players.length]);

  if (!snapshot || !me) return null;

  const colors = colorsForRoomSize(snapshot.maxPlayers);
  const players = [...snapshot.players].sort((a, b) => a.seat - b.seat);
  const seats = Array.from({ length: snapshot.maxPlayers }, (_, index) => players.find((p) => p.seat === index) ?? null);

  const missing = snapshot.maxPlayers - players.length;
  const notReady = players.filter((player) => !player.ready && !player.isHost);
  const offline = players.filter((player) => !player.connected);
  const canStart = missing === 0 && notReady.length === 0 && offline.length === 0;
  const activeRules = RULE_LABELS.filter((rule) => snapshot.rules[rule.key]);

  const statusText = !connected
    ? 'Reconnecting…'
    : missing > 0
      ? `Waiting for ${missing} more player${missing === 1 ? '' : 's'}`
      : offline.length > 0
        ? `${offline.map((p) => p.name).join(', ')} disconnected`
        : notReady.length > 0
          ? `Waiting for ${notReady.map((p) => p.name).join(', ')} to ready up`
          : 'Everyone is ready';

  return (
    <div className="lobby">
      <RoomTopBar code={session.code} connected={connected} onExit={onExit} />

      <main className="lobby__main">
        <section className="card lobby__invite">
          <p className="eyebrow">
            <IconShare size={14} /> Private invite
          </p>
          <div className="lobby__code-row">
            <div>
              <p className="lobby__code-label">Room code</p>
              <p className="lobby__code">{snapshot.code}</p>
            </div>
            <span className="pill pill--gold">
              <IconUsers size={12} /> {players.length}/{snapshot.maxPlayers}
            </span>
          </div>

          <ShareRow code={snapshot.code} />

          <div className="lobby__seats-mini" aria-hidden="true">
            {seats.map((player, index) => (
              <span
                key={index}
                className={`seat-chip ${player ? 'is-filled' : ''}`}
                title={player ? `${player.name} (${COLOR_LABEL[colors[index]!]})` : 'Open seat'}
              >
                <span className={`seat-dot seat-dot--${colors[index]}`} />
                {player ? player.name : 'Open'}
              </span>
            ))}
          </div>

          <div className="lobby__rules">
            <p className="lobby__rules-label">Rules in play</p>
            <div className="chips">
              {activeRules.length === 0 ? (
                <span className="chip">Classic</span>
              ) : (
                activeRules.map((rule) => (
                  <span key={rule.key} className="chip">
                    {rule.label}
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="lobby__tips">
            <p>
              <IconShare size={14} /> Send the link in WhatsApp, Messenger or anywhere else. Friends tap
              once and they are in.
            </p>
            <p>
              <IconBolt size={14} /> The game starts the moment every seat is filled and ready.
            </p>
          </div>
        </section>

        <section className="card lobby__players">
          <header className="lobby__players-head">
            <div>
              <h2>Players</h2>
              <p>{statusText}</p>
            </div>
            <span className="lobby__count">
              {players.length}
              <span>/{snapshot.maxPlayers}</span>
            </span>
          </header>

          <div className={`lobby__seat-grid lobby__seat-grid--${snapshot.maxPlayers}`}>
            {seats.map((player, index) => (
              <PlayerCard
                key={index}
                player={player}
                color={colors[index]!}
                isTurn={false}
                isMe={player?.id === me.id}
                tokensHome={0}
                captures={0}
                ready={player ? (player.isHost ? null : player.ready) : null}
                showKick={isHost}
                onKick={player ? () => void session.kick(player.id) : undefined}
              />
            ))}
          </div>

          <div className="lobby__footer">
            {isHost ? (
              <>
                <button
                  type="button"
                  className="btn btn--primary btn--lg"
                  onClick={() => void session.start()}
                  disabled={!canStart}
                >
                  <IconCrown size={18} />
                  Start game
                </button>
                <p className="lobby__footer-hint">
                  {canStart
                    ? 'All set — deal the first roll.'
                    : missing > 0
                      ? 'Fill every seat to unlock the start button.'
                      : 'Every guest must tap Ready first.'}
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`btn btn--lg ${me.ready ? 'btn--ghost' : 'btn--primary'}`}
                  onClick={() => void session.setReady(!me.ready)}
                >
                  {me.ready ? <IconCheck size={18} /> : null}
                  {me.ready ? 'Ready — tap to undo' : "I'm ready"}
                </button>
                <p className="lobby__footer-hint">The host starts the game once everyone is ready.</p>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
