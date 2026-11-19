import { useMemo } from 'react';
import type { CSSProperties } from 'react';

import { useSettings } from '../lib/settings.tsx';

const COLORS = ['#e0524b', '#3aa96b', '#efb02d', '#4585dd', '#f3d489', '#ffffff'];

export default function Confetti({ active }: { active: boolean }) {
  const { settings } = useSettings();
  const pieces = useMemo(
    () =>
      Array.from({ length: 90 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 1.8,
        duration: 3.4 + Math.random() * 2.6,
        drift: (Math.random() - 0.5) * 160,
        spin: 240 + Math.random() * 720,
        size: 6 + Math.random() * 8,
        color: COLORS[index % COLORS.length]!,
        round: index % 4 === 0,
      })),
    [],
  );

  if (!active || !settings.animations) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={`confetti__piece ${piece.round ? 'confetti__piece--round' : ''}`}
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.size * (piece.round ? 1 : 1.7)}px`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
              '--spin': `${piece.spin}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
