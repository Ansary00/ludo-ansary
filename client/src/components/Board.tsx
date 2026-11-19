import { memo, useMemo } from 'react';

import {
  BASE_SLOTS,
  FINISH_SLOTS,
  HOME_COLUMNS,
  RING,
  SAFE_SET,
  START_INDEX,
  TOKENS_PER_PLAYER,
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
  red: { light: '#f28b83', base: '#e0524b', deep: '#a82a25' },
  green: { light: '#74d29c', base: '#3aa96b', deep: '#1a7448' },
  yellow: { light: '#ffd268', base: '#efb02d', deep: '#ad7708' },
  blue: { light: '#82b7f3', base: '#4585dd', deep: '#1f548f' },
};

const BOARD_COLORS = {
  bg: '#fbf5e7',
  line: '#e0d3b9',
  cell: '#fffdf9',
  yardInner: '#fdf8ee',
  socket: '#fffdf9',
  gold: '#d8a72c',
  goldLight: '#f3d489',
  goldDeep: '#a97c14',
};

const BoardArt = memo(function BoardArt() {
  return (
    <svg className="board__art" viewBox="0 0 15 15" role="img" aria-label="Ludo board">
      <defs>
        {COLORS.map((color) => (
          <linearGradient key={`grad-${color}`} id={`ludo-yard-${color}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE[color].light} />
            <stop offset="100%" stopColor={PALETTE[color].deep} />
          </linearGradient>
        ))}
        {COLORS.map((color) => (
          <linearGradient key={`home-${color}`} id={`ludo-home-${color}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={PALETTE[color].light} stopOpacity="0.95" />
            <stop offset="100%" stopColor={PALETTE[color].base} stopOpacity="0.55" />
          </linearGradient>
        ))}
        <radialGradient id="ludo-center" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#fffdf6" />
          <stop offset="100%" stopColor="#efe4cd" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="15" height="15" rx="0.85" fill={BOARD_COLORS.bg} />
      <rect
        x="0.18"
        y="0.18"
        width="14.64"
        height="14.64"
        rx="0.7"
        fill="none"
        stroke={BOARD_COLORS.line}
        strokeWidth="0.05"
      />

      {/* Home yards */}
      {COLORS.map((color) => {
        const origin =
          color === 'red'
            ? { x: 0, y: 0 }
            : color === 'green'
              ? { x: 9, y: 0 }
              : color === 'yellow'
                ? { x: 9, y: 9 }
                : { x: 0, y: 9 };
        return (
          <g key={color} className="board__yard">
            <rect
              x={origin.x + 0.12}
              y={origin.y + 0.12}
              width={5.76}
              height={5.76}
              rx="0.62"
              fill={`url(#ludo-yard-${color})`}
            />
            <rect
              x={origin.x + 0.44}
              y={origin.y + 0.44}
              width={5.12}
              height={5.12}
              rx="0.5"
              fill={BOARD_COLORS.yardInner}
            />
            <rect
              x={origin.x + 1.06}
              y={origin.y + 1.06}
              width={3.88}
              height={3.88}
              rx="0.42"
              fill={PALETTE[color].base}
              opacity="0.14"
            />
            {BASE_SLOTS[color].map((slot, index) => (
              <circle
                key={index}
                cx={slot.x}
                cy={slot.y}
                r="0.5"
                fill={BOARD_COLORS.socket}
                stroke={PALETTE[color].deep}
                strokeWidth="0.045"
                strokeDasharray="0.13 0.1"
                opacity="0.95"
              />
            ))}
            <text
              x={origin.x + 3}
              y={origin.y + 0.9}
              textAnchor="middle"
              fontSize="0.34"
              letterSpacing="0.09"
              fill="rgba(255,255,255,0.72)"
              fontWeight="700"
            >
              {COLOR_LABEL[color].toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Home columns */}
      {COLORS.map((color) =>
        HOME_COLUMNS[color].map((cell, index) => (
          <rect
            key={`${color}-${index}`}
            x={cell.x + 0.05}
            y={cell.y + 0.05}
            width={0.9}
            height={0.9}
            rx="0.14"
            fill={`url(#ludo-home-${color})`}
            stroke={PALETTE[color].deep}
            strokeOpacity="0.3"
            strokeWidth="0.035"
          />
        )),
      )}

      {/* Track cells */}
      {RING.map((cell, index) => {
        const startColor = START_COLOR[index];
        const safe = SAFE_SET.has(index);
        return (
          <g key={`ring-${index}`}>
            <rect
              x={cell.x + 0.07}
              y={cell.y + 0.07}
              width={0.86}
              height={0.86}
              rx="0.15"
              fill={startColor ? PALETTE[startColor].base : BOARD_COLORS.cell}
              stroke={startColor ? PALETTE[startColor].deep : BOARD_COLORS.line}
              strokeWidth="0.035"
            />
            {startColor && (
              <path
                d="M -0.2 -0.22 L 0.22 0 L -0.2 0.22 Z"
                fill="rgba(255,255,255,0.92)"
                transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${START_ROTATION[startColor]})`}
              />
            )}
            {safe && !startColor && (
              <path
                d={starPath(cell.x + 0.5, cell.y + 0.5, 0.28, 0.12)}
                fill={BOARD_COLORS.gold}
                fillOpacity="0.8"
                stroke={BOARD_COLORS.goldDeep}
                strokeWidth="0.02"
              />
            )}
          </g>
        );
      })}

      {/* Centre finish area */}
      <g>
        <rect
          x="6.02"
          y="6.02"
          width="2.96"
          height="2.96"
          rx="0.3"
          fill="url(#ludo-center)"
          stroke={BOARD_COLORS.gold}
          strokeWidth="0.05"
        />
        <path d="M6.02 6.02 L6.02 8.98 L7.5 7.5 Z" fill={PALETTE.red.base} opacity="0.92" />
        <path d="M6.02 6.02 L8.98 6.02 L7.5 7.5 Z" fill={PALETTE.green.base} opacity="0.92" />
        <path d="M8.98 6.02 L8.98 8.98 L7.5 7.5 Z" fill={PALETTE.yellow.base} opacity="0.92" />
        <path d="M6.02 8.98 L8.98 8.98 L7.5 7.5 Z" fill={PALETTE.blue.base} opacity="0.92" />
        <circle cx="7.5" cy="7.5" r="0.36" fill={BOARD_COLORS.goldLight} stroke={BOARD_COLORS.goldDeep} strokeWidth="0.035" />
        <path d={starPath(7.5, 7.5, 0.21, 0.085)} fill={BOARD_COLORS.goldDeep} opacity="0.85" />
      </g>

      {/* Centre lane arrows pointing home */}
      {COLORS.map((color) => {
        const cells = HOME_COLUMNS[color];
        const cell = cells[cells.length - 1]!;
        return (
          <path
            key={`home-arrow-${color}`}
            d="M -0.16 -0.16 L 0.16 0 L -0.16 0.16 Z"
            fill="rgba(255,255,255,0.85)"
            transform={`translate(${cell.x + 0.5} ${cell.y + 0.5}) rotate(${START_ROTATION[color]})`}
          />
        );
      })}
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
          entries.push({ color, tokenId, pos, x: slot.x, y: slot.y, size: 0.42, stack: 0, stackCount: 1 });
          return;
        }
        const point = pos < 0 ? BASE_SLOTS[color][tokenId]! : cellCenter(cellForStep(color, pos));
        entries.push({ color, tokenId, pos, x: point.x, y: point.y, size: 0.7, stack: 0, stackCount: 1 });
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
