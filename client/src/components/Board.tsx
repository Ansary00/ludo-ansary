import { memo, useMemo } from 'react';

import {
  BASE_SLOTS,
  FINISH_SLOTS,
  HOME_COLUMNS,
  RING,
  SAFE_SET,
  START_INDEX,
  TOKENS_PER_PLAYER,
  YARD_ORIGIN,
  cellCenter,
  cellForStep,
} from '@shared/board.ts';
import type { Color, Move } from '@shared/types.ts';
import { COLORS } from '@shared/types.ts';

import { COLOR_LABEL } from '../lib/format.ts';

export interface BoardGhost {
  id: number;
  color: Color;
  pos: number;
}

interface BoardProps {
  tokens?: Record<Color, number[]> | null;
  activeColors?: Color[];
  currentTurn?: Color | null;
  myColor?: Color | null;
  movable?: Move[];
  selectedToken?: { color: Color; tokenId: number } | null;
  onTokenSelect?: (color: Color, tokenId: number) => void;
  ghosts?: BoardGhost[];
  preview?: boolean;
  className?: string;
}

const START_COLOR: Partial<Record<number, Color>> = {
  [START_INDEX.red]: 'red',
  [START_INDEX.green]: 'green',
  [START_INDEX.yellow]: 'yellow',
  [START_INDEX.blue]: 'blue',
};

/** Star squares belong to the quadrant they guard. */
const STAR_COLOR: Partial<Record<number, Color>> = {
  8: 'red',
  21: 'green',
  34: 'yellow',
  47: 'blue',
};

const START_ROTATION: Record<Color, number> = { red: 0, green: 90, yellow: 180, blue: 270 };

function starPath(cx: number, cy: number, outer = 0.3, inner = 0.13): string {
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${(cx + radius * Math.cos(angle)).toFixed(3)},${(cy + radius * Math.sin(angle)).toFixed(3)}`);
  }
  return `M${points.join('L')}Z`;
}

const PALETTE: Record<Color, { light: string; base: string; deep: string }> = {
  red: { light: '#ff8e86', base: '#e8433c', deep: '#a51f1a' },
  green: { light: '#6fd98c', base: '#21a44f', deep: '#0f6b30' },
  yellow: { light: '#ffd75e', base: '#f2b705', deep: '#a87400' },
  blue: { light: '#8bb9f8', base: '#2f74e0', deep: '#174a9c' },
};

const BOARD = {
  paper: '#ffffff',
  line: '#c8d3e1',
  lineStrong: '#9fb0c6',
};

const BoardArt = memo(function BoardArt() {
  return (
    <svg className="board__art" viewBox="0 0 15 15" role="img" aria-label="Ludo board">
      <defs>
        {COLORS.map((color) => (
          <radialGradient key={`yard-${color}`} id={`ludo-yard-${color}`} cx="32%" cy="24%" r="88%">
            <stop offset="0%" stopColor={PALETTE[color].light} />
            <stop offset="58%" stopColor={PALETTE[color].base} />
            <stop offset="100%" stopColor={PALETTE[color].deep} />
          </radialGradient>
        ))}
        {COLORS.map((color) => (
          <linearGradient key={`home-${color}`} id={`ludo-home-${color}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE[color].light} />
            <stop offset="100%" stopColor={PALETTE[color].base} />
          </linearGradient>
        ))}
      </defs>

      <rect x="0" y="0" width="15" height="15" fill={BOARD.paper} />

      {/* Home yards: thick coloured block, white inset, four token circles */}
      {COLORS.map((color) => {
        const origin = YARD_ORIGIN[color];
        return (
          <g key={color}>
            <rect
              x={origin.x}
              y={origin.y}
              width="6"
              height="6"
              fill={`url(#ludo-yard-${color})`}
            />
            <rect
              x={origin.x + 0.4}
              y={origin.y + 0.4}
              width="5.2"
              height="5.2"
              rx="0.34"
              fill="#ffffff"
            />
            {BASE_SLOTS[color].map((slot, index) => (
              <g key={index}>
                <circle cx={slot.x} cy={slot.y} r="0.66" fill={PALETTE[color].base} />
                <circle
                  cx={slot.x}
                  cy={slot.y}
                  r="0.66"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="0.06"
                />
                <circle cx={slot.x} cy={slot.y} r="0.5" fill={PALETTE[color].deep} opacity="0.35" />
              </g>
            ))}
          </g>
        );
      })}

      {/* Ring cells */}
      {RING.map((cell, index) => {
        const startColor = START_COLOR[index];
        const starColor = STAR_COLOR[index];
        return (
          <g key={`ring-${index}`}>
            <rect
              x={cell.x}
              y={cell.y}
              width="1"
              height="1"
              fill={startColor ? PALETTE[startColor].base : '#ffffff'}
              stroke={startColor ? PALETTE[startColor].deep : BOARD.line}
              strokeWidth="0.022"
            />
            {startColor && (
              <path
                d="M -0.28 -0.3 L 0.3 0 L -0.28 0.3 Z"
                fill="rgba(255,255,255,0.95)"
                transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${START_ROTATION[startColor]})`}
              />
            )}
            {starColor && (
              <path
                d={starPath(cell.x + 0.5, cell.y + 0.5, 0.31, 0.135)}
                fill={PALETTE[starColor].base}
                fillOpacity="0.16"
                stroke={PALETTE[starColor].base}
                strokeWidth="0.055"
                strokeLinejoin="round"
              />
            )}
            {!startColor && !starColor && SAFE_SET.has(index) && (
              <circle cx={cell.x + 0.5} cy={cell.y + 0.5} r="0.1" fill={BOARD.lineStrong} />
            )}
          </g>
        );
      })}

      {/* Home columns */}
      {COLORS.map((color) =>
        HOME_COLUMNS[color].map((cell, index) => (
          <g key={`${color}-home-${index}`}>
            <rect
              x={cell.x}
              y={cell.y}
              width="1"
              height="1"
              fill={`url(#ludo-home-${color})`}
              stroke={PALETTE[color].deep}
              strokeWidth="0.022"
            />
            {index === HOME_COLUMNS[color].length - 1 && (
              <path
                d="M -0.18 -0.2 L 0.2 0 L -0.18 0.2 Z"
                fill="rgba(255,255,255,0.92)"
                transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${START_ROTATION[color]})`}
              />
            )}
          </g>
        )),
      )}

      {/* Centre: four coloured triangles meeting in the middle */}
      <g>
        <rect x="6" y="6" width="3" height="3" fill="#ffffff" />
        <path d="M6 6 L7.5 7.5 L6 9 Z" fill={PALETTE.red.base} />
        <path d="M6 6 L9 6 L7.5 7.5 Z" fill={PALETTE.green.base} />
        <path d="M9 6 L9 9 L7.5 7.5 Z" fill={PALETTE.yellow.base} />
        <path d="M6 9 L9 9 L7.5 7.5 Z" fill={PALETTE.blue.base} />
        <rect
          x="6"
          y="6"
          width="3"
          height="3"
          fill="none"
          stroke={BOARD.lineStrong}
          strokeWidth="0.03"
        />
        <circle cx="7.5" cy="7.5" r="0.34" fill="#ffffff" opacity="0.92" />
        <path
          d={starPath(7.5, 7.5, 0.29, 0.12)}
          fill="#ffffff"
          fillOpacity="0.94"
          stroke={BOARD.lineStrong}
          strokeWidth="0.025"
        />
      </g>

      {/* Board edge */}
      <rect
        x="0.02"
        y="0.02"
        width="14.96"
        height="14.96"
        fill="none"
        stroke={BOARD.lineStrong}
        strokeWidth="0.04"
      />
    </svg>
  );
});

function sameCell(a: { x: number; y: number; pos: number }, b: { x: number; y: number; pos: number }): boolean {
  return a.pos >= 0 && a.pos <= 55 && b.pos >= 0 && b.pos <= 55 && a.x === b.x && a.y === b.y;
}

export default function Board({
  tokens,
  activeColors = ['red', 'green', 'yellow', 'blue'],
  currentTurn = null,
  myColor = null,
  movable = [],
  selectedToken = null,
  onTokenSelect,
  ghosts = [],
  preview = false,
  className = '',
}: BoardProps) {
  const tokenView = useMemo(() => {
    const colors = COLORS.filter((color) => activeColors.includes(color));
    const entries: {
      color: Color;
      tokenId: number;
      pos: number;
      x: number;
      y: number;
      size: number;
      stack: number;
      stackCount: number;
    }[] = [];

    for (const color of colors) {
      const positions = tokens?.[color] ?? Array.from({ length: TOKENS_PER_PLAYER }, () => -1);
      positions.forEach((pos, tokenId) => {
        if (pos === 56) {
          const slot = FINISH_SLOTS[color][tokenId]!;
          entries.push({ color, tokenId, pos, x: slot.x, y: slot.y, size: 0.4, stack: 0, stackCount: 1 });
          return;
        }
        const inBase = pos < 0;
        const point = inBase ? BASE_SLOTS[color][tokenId]! : cellCenter(cellForStep(color, pos));
        entries.push({
          color,
          tokenId,
          pos,
          x: point.x,
          y: point.y,
          size: inBase ? 0.94 : 0.7,
          stack: 0,
          stackCount: 1,
        });
      });
    }

    for (const entry of entries) {
      const group = entries.filter((other) => sameCell(entry, other));
      entry.stackCount = group.length;
      entry.stack = group.indexOf(entry);
      if (group.length > 1) entry.size = 0.56;
      if (group.length > 1) {
        const angle = (entry.stack / group.length) * Math.PI * 2 - Math.PI / 2;
        entry.x += Math.cos(angle) * 0.13;
        entry.y += Math.sin(angle) * 0.13;
      }
    }

    return entries;
  }, [tokens, activeColors]);

  const movableKeys = useMemo(
    () => new Set(movable.map((move) => `${move.tokenId}`)),
    [movable],
  );

  return (
    <div
      className={`board ${preview ? 'board--preview' : ''} ${className}`}
      data-turn={currentTurn ?? undefined}
      data-my={myColor ?? undefined}
    >
      <div className="board__frame">
        <BoardArt />
        <div className="board__tokens">
          {ghosts.map((ghost) => {
            const point = cellCenter(cellForStep(ghost.color, Math.max(0, ghost.pos)));
            return (
              <span
                key={`ghost-${ghost.id}`}
                className={`token token--${ghost.color} token--ghost`}
                style={{
                  left: `${(point.x / 15) * 100}%`,
                  top: `${(point.y / 15) * 100}%`,
                  width: `${(0.7 / 15) * 100}%`,
                  height: `${(0.7 / 15) * 100}%`,
                }}
                aria-hidden="true"
              />
            );
          })}
          {tokenView.map((entry) => {
            const isMine = myColor === entry.color;
            const canMove = !preview && isMine && movableKeys.has(`${entry.tokenId}`);
            const selected =
              selectedToken?.color === entry.color && selectedToken.tokenId === entry.tokenId;
            const finished = entry.pos === 56;
            return (
              <button
                key={`${entry.color}-${entry.tokenId}`}
                type="button"
                className={[
                  'token',
                  `token--${entry.color}`,
                  canMove ? 'token--movable' : '',
                  selected ? 'token--selected' : '',
                  finished ? 'token--finished' : '',
                  entry.pos < 0 ? 'token--base' : '',
                  preview ? 'token--preview' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${(entry.x / 15) * 100}%`,
                  top: `${(entry.y / 15) * 100}%`,
                  width: `${(entry.size / 15) * 100}%`,
                  height: `${(entry.size / 15) * 100}%`,
                  zIndex: selected ? 40 : canMove ? 30 : 10 + entry.stack,
                }}
                onClick={canMove && onTokenSelect ? () => onTokenSelect(entry.color, entry.tokenId) : undefined}
                disabled={!canMove}
                aria-label={`${COLOR_LABEL[entry.color]} token ${entry.tokenId + 1}${
                  finished ? ' (home)' : canMove ? ' — can move' : ''
                }`}
                tabIndex={canMove ? 0 : -1}
              >
                <span className="token__shadow" aria-hidden="true" />
                <span className="token__body" aria-hidden="true">
                  <span className="token__gloss" />
                  <span className="token__ring" />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
