import {
  FINAL_STEP,
  RING_LENGTH,
  SAFE_SET,
  START_INDEX,
  TOKENS_PER_PLAYER,
} from './board.ts';
import type {
  Color,
  GameState,
  LastAction,
  LogType,
  Move,
  MoveOutcome,
  PlayerStats,
  Ranking,
  Rules,
} from './types.ts';
import { COLORS, DEFAULT_RULES } from './types.ts';

export class GameError extends Error {
  code: string;
  constructor(message: string, code = 'invalid-move') {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

const MAX_LOG = 40;

function emptyStats(): PlayerStats {
  return { rolls: 0, sixes: 0, moves: 0, captures: 0, lost: 0, finished: 0 };
}

function clone(state: GameState): GameState {
  const tokens = {} as Record<Color, number[]>;
  const stats = {} as Record<Color, PlayerStats>;
  for (const color of COLORS) {
    tokens[color] = [...state.tokens[color]];
    stats[color] = { ...state.stats[color] };
  }
  return {
    ...state,
    activeColors: [...state.activeColors],
    tokens,
    stats,
    finishedOrder: [...state.finishedOrder],
    log: [...state.log],
    rules: { ...state.rules },
    rankings: state.rankings ? [...state.rankings] : undefined,
  };
}

function pushLog(
  state: GameState,
  type: LogType,
  color: Color,
  extra: Partial<Pick<import('./types.ts').LogEntry, 'dice' | 'from' | 'to' | 'captured'>> = {},
): void {
  state.logSeq += 1;
  state.log.push({ id: state.logSeq, type, color, at: Date.now(), ...extra });
  if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
}

export function normalizeRules(input: Partial<Rules> | undefined): Rules {
  const merged = { ...DEFAULT_RULES, ...(input ?? {}) };
  return {
    extraTurnOnSix: Boolean(merged.extraTurnOnSix),
    extraTurnOnCapture: Boolean(merged.extraTurnOnCapture),
    extraTurnOnHome: Boolean(merged.extraTurnOnHome),
    threeSixesForfeit: Boolean(merged.threeSixesForfeit),
    captureOnSafe: Boolean(merged.captureOnSafe),
  };
}

export function createGame(activeColors: Color[], rules: Rules = DEFAULT_RULES): GameState {
  if (activeColors.length < 2 || activeColors.length > 4) {
    throw new GameError('A game needs 2 to 4 players', 'invalid-players');
  }
  if (new Set(activeColors).size !== activeColors.length) {
    throw new GameError('Player colors must be unique', 'invalid-players');
  }
  const tokens = {} as Record<Color, number[]>;
  const stats = {} as Record<Color, PlayerStats>;
  for (const color of COLORS) {
    tokens[color] = Array.from({ length: TOKENS_PER_PLAYER }, () => -1);
    stats[color] = emptyStats();
  }
  const state: GameState = {
    activeColors: [...activeColors],
    tokens,
    stats,
    turnColor: activeColors[0]!,
    dice: null,
    sixStreak: 0,
    finishedOrder: [],
    phase: 'playing',
    winner: null,
    startedAt: Date.now(),
    finishedAt: null,
    moveCount: 0,
    log: [],
    logSeq: 0,
    rules: normalizeRules(rules),
  };
  pushLog(state, 'start', activeColors[0]!);
  return state;
}

/** All legal moves for the given color and dice value. */
export function getLegalMoves(
  state: GameState,
  color: Color = state.turnColor,
  dice: number | null = state.dice,
): Move[] {
  if (state.phase !== 'playing' || dice === null) return [];
  if (!state.activeColors.includes(color)) return [];
  const moves: Move[] = [];
  state.tokens[color].forEach((pos, tokenId) => {
    if (pos === FINAL_STEP) return;
    if (pos < 0) {
      if (dice !== 6) return;
      moves.push(describeMove(state, color, tokenId, -1, 0));
      return;
    }
    const to = pos + dice;
    if (to > FINAL_STEP) return;
    moves.push(describeMove(state, color, tokenId, pos, to));
  });
  return moves;
}

function describeMove(
  state: GameState,
  color: Color,
  tokenId: number,
  from: number,
  to: number,
): Move {
  let ringIndex: number | null = null;
  const captures: { color: Color; tokenId: number }[] = [];
  if (to <= 50) {
    ringIndex = (START_INDEX[color] + to) % RING_LENGTH;
    const safe = SAFE_SET.has(ringIndex);
    if (safe && !state.rules.captureOnSafe) {
      return { tokenId, from, to, captures, finishes: false, ringIndex };
    }
    for (const other of state.activeColors) {
      if (other === color) continue;
      state.tokens[other].forEach((pos, otherTokenId) => {
        if (pos < 0 || pos > 50) return;
        if ((START_INDEX[other] + pos) % RING_LENGTH === ringIndex) {
          captures.push({ color: other, tokenId: otherTokenId });
        }
      });
    }
  }
  return { tokenId, from, to, captures, finishes: to === FINAL_STEP, ringIndex };
}

/** Roll the dice for the player whose turn it is. */
export function rollDice(state: GameState, dice: number): GameState {
  if (state.phase !== 'playing') throw new GameError('The game has already finished', 'game-over');
  if (state.dice !== null) throw new GameError('The dice has already been rolled', 'dice-already-rolled');
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new GameError('Invalid dice value', 'invalid-dice');

  const next = clone(state);
  const color = next.turnColor;
  next.dice = dice;
  next.stats[color].rolls += 1;
  if (dice === 6) {
    next.sixStreak += 1;
    next.stats[color].sixes += 1;
  } else {
    next.sixStreak = 0;
  }
  pushLog(next, 'roll', color, { dice });
  next.lastAction = { type: 'roll', color, dice };

  if (dice === 6 && next.rules.threeSixesForfeit && next.sixStreak >= 3) {
    pushLog(next, 'forfeit', color, { dice });
    next.lastAction = { type: 'forfeit-sixes', color };
    return advanceTurn(next);
  }
  return next;
}

/** Apply a token move. The dice must already have been rolled. */
export function applyMove(state: GameState, tokenId: number): MoveOutcome {
  if (state.phase !== 'playing') throw new GameError('The game has already finished', 'game-over');
  if (state.dice === null) throw new GameError('Roll the dice first', 'dice-not-rolled');
  if (!Number.isInteger(tokenId) || tokenId < 0 || tokenId >= TOKENS_PER_PLAYER) {
    throw new GameError('Unknown token', 'invalid-token');
  }
  const color = state.turnColor;
  const dice = state.dice;
  const legal = getLegalMoves(state, color, dice).find((m) => m.tokenId === tokenId);
  if (!legal) throw new GameError('That token cannot move with this roll', 'illegal-move');

  const next = clone(state);
  next.dice = null;
  next.tokens[color][tokenId] = legal.to;
  next.stats[color].moves += 1;
  next.moveCount += 1;
  pushLog(next, 'move', color, { from: legal.from, to: legal.to, dice });

  const captured = legal.captures.map((c) => ({ ...c }));
  for (const victim of captured) {
    next.tokens[victim.color][victim.tokenId] = -1;
    next.stats[victim.color].lost += 1;
    next.stats[color].captures += 1;
  }
  if (captured.length > 0) {
    pushLog(next, 'capture', color, { captured });
  }

  const finished = legal.to === FINAL_STEP;
  if (finished) {
    next.stats[color].finished = next.tokens[color].filter((p) => p === FINAL_STEP).length;
    pushLog(next, 'finish', color, { to: FINAL_STEP });
  }

  const extraTurn =
    (dice === 6 && next.rules.extraTurnOnSix) ||
    (captured.length > 0 && next.rules.extraTurnOnCapture) ||
    (finished && next.rules.extraTurnOnHome);

  const allHome = next.tokens[color].every((p) => p === FINAL_STEP);
  let gameOver = false;

  if (allHome && !next.finishedOrder.includes(color)) {
    next.finishedOrder.push(color);
    next.phase = 'finished';
    next.winner = color;
    next.finishedAt = Date.now();
    next.rankings = computeRankings(next);
    next.lastAction = { type: 'game-over', color };
    pushLog(next, 'end', color);
    gameOver = true;
  } else if (extraTurn) {
    next.sixStreak = dice === 6 ? next.sixStreak : 0;
    next.lastAction = { type: 'move', color, tokenId, from: legal.from, to: legal.to };
  } else {
    next.lastAction = { type: 'move', color, tokenId, from: legal.from, to: legal.to };
    advanceTurnInPlace(next);
  }

  return {
    state: next,
    move: {
      tokenId,
      from: legal.from,
      to: legal.to,
      captured,
      finished,
      extraTurn: extraTurn && !gameOver,
      gameOver,
      winner: next.winner,
    },
  };
}

/** Pass the turn when the roll produced no legal move. */
export function passTurn(state: GameState): GameState {
  if (state.phase !== 'playing') throw new GameError('The game has already finished', 'game-over');
  const next = clone(state);
  next.dice = null;
  next.lastAction = { type: 'pass', color: next.turnColor, reason: 'no-moves' };
  pushLog(next, 'pass', next.turnColor);
  advanceTurnInPlace(next);
  return next;
}

export function advanceTurn(state: GameState): GameState {
  const next = clone(state);
  advanceTurnInPlace(next);
  return next;
}

function advanceTurnInPlace(state: GameState): void {
  const order = state.activeColors;
  const currentIdx = order.indexOf(state.turnColor);
  for (let hop = 1; hop <= order.length; hop += 1) {
    const candidate = order[(currentIdx + hop) % order.length]!;
    const done = state.tokens[candidate].every((p) => p === FINAL_STEP);
    if (!done) {
      state.turnColor = candidate;
      state.dice = null;
      state.sixStreak = 0;
      return;
    }
  }
  // Nobody can play: finish the game defensively.
  state.phase = 'finished';
  state.finishedAt = state.finishedAt ?? Date.now();
  state.rankings = computeRankings(state);
  if (!state.winner) {
    state.winner = [...state.activeColors].sort((a, b) => progressPoints(state, b) - progressPoints(state, a))[0] ?? null;
  }
}

export function tokensHome(state: GameState, color: Color): number {
  return state.tokens[color].filter((p) => p === FINAL_STEP).length;
}

export function progressPoints(state: GameState, color: Color): number {
  return state.tokens[color].reduce((sum, pos) => sum + (pos < 0 ? 0 : pos + 1), 0);
}

export function computeRankings(state: GameState): Ranking[] {
  const ordered = [...state.finishedOrder];
  const remaining = state.activeColors
    .filter((c) => !ordered.includes(c))
    .sort((a, b) => {
      const homeDiff = tokensHome(state, b) - tokensHome(state, a);
      if (homeDiff !== 0) return homeDiff;
      return progressPoints(state, b) - progressPoints(state, a);
    });
  return [...ordered, ...remaining].map((color, index) => ({
    color,
    rank: index + 1,
    tokensHome: tokensHome(state, color),
    progress: progressPoints(state, color),
    captures: state.stats[color].captures,
    lost: state.stats[color].lost,
    sixes: state.stats[color].sixes,
    rolls: state.stats[color].rolls,
    moves: state.stats[color].moves,
  }));
}

/**
 * Deterministic helper used by the server when a disconnected player's turn
 * must be auto-played: prefer captures, then finishing moves, then the most
 * advanced token.
 */
export function chooseAutoMove(state: GameState): number | null {
  if (state.dice === null) return null;
  const moves = getLegalMoves(state);
  if (moves.length === 0) return null;
  const scored = moves.map((m) => ({
    m,
    score:
      (m.captures.length > 0 ? 1000 : 0) +
      (m.finishes ? 500 : 0) +
      (m.from < 0 ? 50 : 0) +
      m.to,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0]!.m.tokenId;
}

export function actionLabel(action: LastAction | undefined): string {
  if (!action) return '';
  switch (action.type) {
    case 'roll':
      return `rolled ${action.dice}`;
    case 'move':
      return 'moved a token';
    case 'forfeit-sixes':
      return 'rolled three sixes and lost the turn';
    case 'pass':
      return 'had no legal move';
    case 'game-over':
      return 'won the game';
    default:
      return '';
  }
}
