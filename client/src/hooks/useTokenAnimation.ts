import { useEffect, useRef, useState } from 'react';

import { FINAL_STEP } from '@shared/board.ts';
import type { Color, GameState } from '@shared/types.ts';
import { COLORS } from '@shared/types.ts';

export interface GhostToken {
  id: number;
  color: Color;
  pos: number;
}

interface Task {
  kind: 'steps' | 'snap' | 'base';
  color: Color;
  tokenId: number;
  to: number;
  from: number;
  steps: number[];
}

const STEP_MS = 125;
const BASE_MS = 220;

function cloneTokens(game: GameState | null): Record<Color, number[]> {
  const result = {} as Record<Color, number[]>;
  for (const color of COLORS) {
    result[color] = game ? [...game.tokens[color]] : [-1, -1, -1, -1];
  }
  return result;
}

/**
 * Renders tokens a step at a time so movement follows the board's path.
 * The server state is always the source of truth; this hook only interpolates.
 */
export function useTokenAnimation(game: GameState | null) {
  const [tokens, setTokens] = useState<Record<Color, number[]>>(() => cloneTokens(game));
  const [ghosts, setGhosts] = useState<GhostToken[]>([]);
  const tokensRef = useRef(tokens);
  const queueRef = useRef<Task[]>([]);
  const runningRef = useRef(false);
  const gameIdRef = useRef<number | null>(game?.startedAt ?? null);
  const ghostIdRef = useRef(0);
  const timersRef = useRef<Set<number>>(new Set());
  const liveRef = useRef(true);

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
    return id;
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => schedule(resolve, ms));

  const setToken = (color: Color, tokenId: number, pos: number) => {
    setTokens((previous) => {
      const next = { ...previous, [color]: [...previous[color]] };
      next[color][tokenId] = pos;
      tokensRef.current = next;
      return next;
    });
  };

  const runQueue = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    while (queueRef.current.length > 0 && liveRef.current) {
      const task = queueRef.current.shift()!;
      if (task.kind === 'base') {
        if (task.from >= 0) {
          ghostIdRef.current += 1;
          const ghost: GhostToken = { id: ghostIdRef.current, color: task.color, pos: task.from };
          setGhosts((current) => [...current, ghost]);
          schedule(() => setGhosts((current) => current.filter((item) => item.id !== ghost.id)), 820);
        }
        await sleep(BASE_MS);
        setToken(task.color, task.tokenId, -1);
      } else if (task.kind === 'snap') {
        setToken(task.color, task.tokenId, task.to);
      } else {
        for (const step of task.steps) {
          if (!liveRef.current) return;
          setToken(task.color, task.tokenId, step);
          await sleep(STEP_MS);
        }
        setToken(task.color, task.tokenId, task.to);
      }
      if (liveRef.current) await sleep(25);
    }
    runningRef.current = false;
  };

  const signature = game
    ? `${game.startedAt}:${game.moveCount}:${COLORS.map((color) => game.tokens[color].join('.')).join('|')}`
    : '';

  useEffect(() => {
    if (!game) {
      const empty = cloneTokens(null);
      tokensRef.current = empty;
      setTokens(empty);
      return;
    }

    if (gameIdRef.current !== game.startedAt) {
      gameIdRef.current = game.startedAt;
      queueRef.current = [];
      const reset = cloneTokens(game);
      tokensRef.current = reset;
      setTokens(reset);
      setGhosts([]);
      return;
    }

    const tasks: Task[] = [];
    for (const color of game.activeColors) {
      for (let tokenId = 0; tokenId < 4; tokenId += 1) {
        const current = tokensRef.current[color][tokenId]!;
        const next = game.tokens[color][tokenId]!;
        if (current === next) continue;
        if (next === -1) {
          tasks.push({ kind: 'base', color, tokenId, from: current, to: -1, steps: [] });
        } else if (current === -1) {
          tasks.push({ kind: 'steps', color, tokenId, from: -1, to: next, steps: [0] });
        } else if (next > current && next - current <= 6) {
          const steps: number[] = [];
          for (let step = current + 1; step <= Math.min(next, FINAL_STEP - 1); step += 1) steps.push(step);
          tasks.push({ kind: 'steps', color, tokenId, from: current, to: next, steps });
        } else {
          tasks.push({ kind: 'snap', color, tokenId, from: current, to: next, steps: [] });
        }
      }
    }
    if (tasks.length === 0) return;
    queueRef.current.push(...tasks);
    void runQueue();
    // The signature is the stable description of the server token state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  useEffect(() => {
    liveRef.current = true;
    return () => {
      liveRef.current = false;
      for (const id of timersRef.current) window.clearTimeout(id);
      timersRef.current.clear();
    };
  }, []);

  return { tokens, ghosts };
}
