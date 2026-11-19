import type { PublicPlayer } from '@shared/protocol.ts';
import type { Color } from '@shared/types.ts';

import { COLOR_LABEL, initials } from '../lib/format.ts';
import { IconCrown, IconWifi } from './Icons.tsx';
import { useCountdown } from './Toggle.tsx';

export default function PlayerCard({
  player,
  color,
  isTurn,
  isMe,
  tokensHome,
  captures,
  autoPlayAt,
  onKick,
  showKick,
  ready,
}: {
  player: PublicPlayer | null;
  color: Color;
  isTurn: boolean;
  isMe: boolean;
  tokensHome: number;
  captures: number;
  autoPlayAt?: number | null;
  onKick?: () => void;
  showKick?: boolean;
  ready?: boolean | null;
}) {
  const countdown = useCountdown(isTurn && autoPlayAt ? autoPlayAt : null);
  const offline = player ? !player.connected : false;

  return (
    <article
      className={[
        'pcard',
        `pcard--${color}`,
        isTurn ? 'pcard--turn' : '',
        isMe ? 'pcard--me' : '',
        !player ? 'pcard--empty' : '',
        offline ? 'pcard--offline' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="pcard__avatar" aria-hidden="true">
        {player ? <span>{initials(player.name)}</span> : <span className="pcard__plus">+</span>}
      </div>
      <div className="pcard__body">
        <div className="pcard__name-row">
          <span className="pcard__name">{player ? player.name : 'Open seat'}</span>
          {player?.isHost && (
            <span className="pill pill--gold" title="Host">
              <IconCrown size={11} /> Host
            </span>
          )}
          {isMe && <span className="pill pill--me">You</span>}
          {typeof ready === 'boolean' && player && (
            <span className={`pill ${ready ? 'pill--ready' : 'pill--muted'}`}>
              {ready ? 'Ready' : 'Not ready'}
            </span>
          )}
        </div>
        <div className="pcard__meta">
          <span className={`pcard__dot pcard__dot--${color}`} />
          <span>{COLOR_LABEL[color]}</span>
          {player && (
            <span className={`pcard__conn ${offline ? 'is-offline' : ''}`} title={offline ? 'Disconnected' : 'Connected'}>
              <IconWifi size={12} offline={offline} />
              {offline ? 'Away' : 'Live'}
            </span>
          )}
        </div>
        {player && (
          <div className="pcard__stats">
            <span className="pcard__homes" aria-label={`${tokensHome} of 4 tokens home`}>
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className={`pcard__home-dot ${index < tokensHome ? 'is-filled' : ''}`} />
              ))}
            </span>
            <span className="pcard__stat" title="Captures">
              {captures} cap
            </span>
          </div>
        )}
        {isTurn && countdown > 0 && offline && (
          <p className="pcard__autoplay">Auto-playing in {countdown}s</p>
        )}
      </div>
      {showKick && player && !player.isHost && onKick && (
        <button type="button" className="pcard__kick" onClick={onKick} title={`Remove ${player.name}`}>
          Remove
        </button>
      )}
    </article>
  );
}
