import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import type { Color } from '@shared/types.ts';

import Board from '../components/Board.tsx';
import {
  IconArrowRight,
  IconBolt,
  IconCrown,
  IconShare,
  IconSparkle,
  IconUsers,
} from '../components/Icons.tsx';
import SiteHeader from '../components/SiteHeader.tsx';

const PREVIEW_TOKENS: Record<Color, number[]> = {
  red: [0, 9, 24, 56],
  green: [5, 19, 33, 56],
  yellow: [51, 53, 40, -1],
  blue: [12, 27, 44, 56],
};

export default function HomePage() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const joinWithCode = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length >= 4) navigate(`/room/${clean}`);
  };

  return (
    <div className="page home">
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="hero__glow hero__glow--one" aria-hidden="true" />
          <div className="hero__glow hero__glow--two" aria-hidden="true" />
          <div className="hero__inner">
            <div className="hero__copy">
              <p className="eyebrow">
                <IconSparkle size={14} />
                Free online multiplayer Ludo
              </p>
              <h1 className="hero__title">
                Roll. Race.
                <span> Rule the board.</span>
              </h1>
              <p className="hero__lede">
                Create a private room, send one link, and play a classic game of Ludo with friends in
                real time. No downloads, no sign-ups, no ads — just the board.
              </p>

              <div className="hero__actions">
                <Link to="/create" className="btn btn--primary btn--lg">
                  Create private room
                  <IconArrowRight size={18} />
                </Link>
                <form className="join-inline" onSubmit={joinWithCode}>
                  <label className="visually-hidden" htmlFor="hero-code">
                    Room code
                  </label>
                  <input
                    id="hero-code"
                    className="input join-inline__input"
                    placeholder="Room code"
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 8))}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={8}
                  />
                  <button type="submit" className="btn btn--ghost btn--lg" disabled={code.trim().length < 4}>
                    Join
                  </button>
                </form>
              </div>

              <ul className="hero__bullets">
                <li>
                  <IconUsers size={15} /> 2–4 players
                </li>
                <li>
                  <IconBolt size={15} /> Real-time sync
                </li>
                <li>
                  <IconShare size={15} /> One-tap invite link
                </li>
              </ul>
            </div>

            <div className="hero__board">
              <div className="hero__board-glow" aria-hidden="true" />
              <Board
                tokens={PREVIEW_TOKENS}
                activeColors={['red', 'green', 'yellow', 'blue']}
                currentTurn="red"
                preview
              />
              <div className="hero__floating-card hero__floating-card--top" aria-hidden="true">
                <span className="hero__floating-dot hero__floating-dot--green" />
                Mia joined the room
              </div>
              <div className="hero__floating-card hero__floating-card--bottom" aria-hidden="true">
                <span className="hero__floating-die">6</span>
                Extra turn unlocked
              </div>
            </div>
          </div>

          <div className="hero__marquee" aria-hidden="true">
            <span>Roll a six to leave home</span>
            <span className="hero__marquee-dot">◆</span>
            <span>Capture rivals on the track</span>
            <span className="hero__marquee-dot">◆</span>
            <span>First player with all four tokens home wins</span>
            <span className="hero__marquee-dot">◆</span>
            <span>Play on phone, tablet or desktop</span>
          </div>
        </section>

        <section className="home-section" id="how">
          <div className="home-section__head">
            <p className="eyebrow">Three steps</p>
            <h2>From link to first roll in under a minute</h2>
          </div>
          <div className="steps">
            {[
              {
                step: '01',
                title: 'Create a room',
                text: 'Pick a name and choose 2, 3 or 4 players. Your private room is ready instantly.',
              },
              {
                step: '02',
                title: 'Share the link',
                text: 'Copy the invite link or use the native share sheet for WhatsApp, Messenger or iMessage.',
              },
              {
                step: '03',
                title: 'Play live',
                text: 'Everyone sees every roll and move in real time. Refresh any time — your seat is saved.',
              },
            ].map((item) => (
              <article key={item.step} className="step-card">
                <span className="step-card__number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-section" id="features">
          <div className="home-section__head">
            <p className="eyebrow">Built for game night</p>
            <h2>Premium board energy. Zero cost.</h2>
          </div>
          <div className="feature-grid">
            <article className="feature">
              <span className="feature__icon">
                <IconCrown />
              </span>
              <h3>Private rooms only</h3>
              <p>No public matchmaking and no strangers. Share the link with exactly who you want.</p>
            </article>
            <article className="feature">
              <span className="feature__icon">
                <IconBolt />
              </span>
              <h3>Server-authoritative</h3>
              <p>Every roll and move is validated on the server, so the board stays in sync for everyone.</p>
            </article>
            <article className="feature">
              <span className="feature__icon">
                <IconSparkle />
              </span>
              <h3>Made to feel good</h3>
              <p>Animated dice, smooth token travel, sound design and a board that scales to any screen.</p>
            </article>
            <article className="feature">
              <span className="feature__icon">
                <IconUsers />
              </span>
              <h3>Reconnects gracefully</h3>
              <p>Lost signal? Reopen the link and your seat and board are restored mid-game.</p>
            </article>
          </div>
        </section>

        <section className="home-cta">
          <div className="home-cta__inner">
            <h2>The board is set. Bring your friends.</h2>
            <p>Free to play forever. No account, no install, no ads.</p>
            <div className="home-cta__actions">
              <Link to="/create" className="btn btn--primary btn--lg">
                Create a room
                <IconArrowRight size={18} />
              </Link>
              <Link to="/join" className="btn btn--ghost btn--lg">
                Join with a code
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>Ludo ANSARY — an original, free-to-play Ludo board. Not affiliated with any other brand.</p>
          <p className="site-footer__muted">Built with React, Node.js and Socket.IO.</p>
        </div>
      </footer>
    </div>
  );
}
