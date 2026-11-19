/**
 * Shared domain types for the Ludo game.
 * These are used by the authoritative server and mirrored by the client.
 */

export type Color = 'red' | 'green' | 'yellow' | 'blue';

export const COLORS = ['red', 'green', 'yellow', 'blue'] as const;

export interface Cell {
  /** Column index on the 15x15 grid (0 = left). */
  x: number;
  /** Row index on the 15x15 grid (0 = top). */
  y: number;
}

/** Extra-turn and safety variations. Defaults follow classic Ludo. */
export interface Rules {
  extraTurnOnSix: boolean;
  extraTurnOnCapture: boolean;
  extraTurnOnHome: boolean;
  threeSixesForfeit: boolean;
  captureOnSafe: boolean;
}

export const DEFAULT_RULES: Rules = {
  extraTurnOnSix: true,
  extraTurnOnCapture: true,
  extraTurnOnHome: true,
  threeSixesForfeit: false,
  captureOnSafe: false,
};

export interface PlayerStats {
  rolls: number;
  sixes: number;
  moves: number;
  captures: number;
  lost: number;
  finished: number;
}

export type LogType = 'roll' | 'move' | 'capture' | 'finish' | 'pass' | 'forfeit' | 'start' | 'end';

export interface LogEntry {
  id: number;
  type: LogType;
  color: Color;
  dice?: number;
  from?: number;
  to?: number;
  captured?: { color: Color; tokenId: number }[];
  at: number;
}

export type LastAction =
  | { type: 'roll'; color: Color; dice: number }
  | { type: 'move'; color: Color; tokenId: number; from: number; to: number }
  | { type: 'forfeit-sixes'; color: Color }
  | { type: 'pass'; color: Color; reason: 'no-moves' }
  | { type: 'game-over'; color: Color | null };

/**
 * Authoritative game state. Steps 0..50 are ring cells, 51..55 are the five
 * home-column cells and 56 is the final home. -1 means "in base".
 */
export interface GameState {
  activeColors: Color[];
  tokens: Record<Color, number[]>;
  turnColor: Color;
  dice: number | null;
  sixStreak: number;
  finishedOrder: Color[];
  phase: 'playing' | 'finished';
  winner: Color | null;
  startedAt: number;
  finishedAt: number | null;
  moveCount: number;
  log: LogEntry[];
  logSeq: number;
  stats: Record<Color, PlayerStats>;
  rules: Rules;
  lastAction?: LastAction;
  rankings?: Ranking[];
}

export interface Move {
  tokenId: number;
  from: number;
  to: number;
  /** Opponent tokens that would be sent back to base. */
  captures: { color: Color; tokenId: number }[];
  /** True when this move finishes the token. */
  finishes: boolean;
  /** Ring index of the destination when the destination is on the ring. */
  ringIndex: number | null;
}

export interface Ranking {
  color: Color;
  rank: number;
  tokensHome: number;
  progress: number;
  captures: number;
  lost: number;
  sixes: number;
  rolls: number;
  moves: number;
}

export interface MoveOutcome {
  state: GameState;
  move: {
    tokenId: number;
    from: number;
    to: number;
    captured: { color: Color; tokenId: number }[];
    finished: boolean;
    extraTurn: boolean;
    gameOver: boolean;
    winner: Color | null;
  };
}
