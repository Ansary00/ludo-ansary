import type { Cell, Color } from './types.ts';

/**
 * Board geometry for a traditional 15x15 Ludo board.
 *
 * Layout (clockwise play order):
 *   red (top-left) -> green (top-right) -> yellow (bottom-right) -> blue (bottom-left)
 *
 * The ring holds 52 cells. A token that has left its base is at step 0..56:
 *   0..50  ring cells (51 cells, starting at the player's start square)
 *   51..55 home column (5 cells)
 *   56     final home (centre)
 */
export const BOARD_SIZE = 15;
export const RING_LENGTH = 52;
export const FINAL_STEP = 56;
export const TOKENS_PER_PLAYER = 4;

/** Ring cells in travel order. */
export const RING: Cell[] = [
  { x: 6, y: 13 },
  { x: 6, y: 12 },
  { x: 6, y: 11 },
  { x: 6, y: 10 },
  { x: 6, y: 9 },
  { x: 5, y: 8 },
  { x: 4, y: 8 },
  { x: 3, y: 8 },
  { x: 2, y: 8 },
  { x: 1, y: 8 },
  { x: 0, y: 8 },
  { x: 0, y: 7 },
  { x: 0, y: 6 },
  { x: 1, y: 6 },
  { x: 2, y: 6 },
  { x: 3, y: 6 },
  { x: 4, y: 6 },
  { x: 5, y: 6 },
  { x: 6, y: 5 },
  { x: 6, y: 4 },
  { x: 6, y: 3 },
  { x: 6, y: 2 },
  { x: 6, y: 1 },
  { x: 6, y: 0 },
  { x: 7, y: 0 },
  { x: 8, y: 0 },
  { x: 8, y: 1 },
  { x: 8, y: 2 },
  { x: 8, y: 3 },
  { x: 8, y: 4 },
  { x: 8, y: 5 },
  { x: 9, y: 6 },
  { x: 10, y: 6 },
  { x: 11, y: 6 },
  { x: 12, y: 6 },
  { x: 13, y: 6 },
  { x: 14, y: 6 },
  { x: 14, y: 7 },
  { x: 14, y: 8 },
  { x: 13, y: 8 },
  { x: 12, y: 8 },
  { x: 11, y: 8 },
  { x: 10, y: 8 },
  { x: 9, y: 8 },
  { x: 8, y: 9 },
  { x: 8, y: 10 },
  { x: 8, y: 11 },
  { x: 8, y: 12 },
  { x: 8, y: 13 },
  { x: 8, y: 14 },
  { x: 7, y: 14 },
  { x: 6, y: 14 },
];

/** Ring index of each player's start square. */
export const START_INDEX: Record<Color, number> = {
  red: 13,
  green: 26,
  yellow: 39,
  blue: 0,
};

/** The five home-column cells, ordered from the ring entrance to the centre. */
export const HOME_COLUMNS: Record<Color, Cell[]> = {
  red: [
    { x: 1, y: 7 },
    { x: 2, y: 7 },
    { x: 3, y: 7 },
    { x: 4, y: 7 },
    { x: 5, y: 7 },
  ],
  green: [
    { x: 7, y: 1 },
    { x: 7, y: 2 },
    { x: 7, y: 3 },
    { x: 7, y: 4 },
    { x: 7, y: 5 },
  ],
  yellow: [
    { x: 13, y: 7 },
    { x: 12, y: 7 },
    { x: 11, y: 7 },
    { x: 10, y: 7 },
    { x: 9, y: 7 },
  ],
  blue: [
    { x: 7, y: 13 },
    { x: 7, y: 12 },
    { x: 7, y: 11 },
    { x: 7, y: 10 },
    { x: 7, y: 9 },
  ],
};

/** Top-left corner of each 6x6 yard. */
export const YARD_ORIGIN: Record<Color, Cell> = {
  red: { x: 0, y: 0 },
  green: { x: 9, y: 0 },
  yellow: { x: 9, y: 9 },
  blue: { x: 0, y: 9 },
};

/**
 * Safe squares: the four start squares plus the four star squares eight steps
 * ahead of each start (symmetric across the board).
 */
export const SAFE_RING_INDICES: number[] = [0, 8, 13, 21, 26, 34, 39, 47];

export const SAFE_SET = new Set<number>(SAFE_RING_INDICES);

/** Base slots (cell-centre coordinates) for the four tokens inside a yard. */
export const BASE_SLOTS: Record<Color, Cell[]> = {
  red: [
    { x: 1.9, y: 1.9 },
    { x: 4.1, y: 1.9 },
    { x: 1.9, y: 4.1 },
    { x: 4.1, y: 4.1 },
  ],
  green: [
    { x: 10.9, y: 1.9 },
    { x: 13.1, y: 1.9 },
    { x: 10.9, y: 4.1 },
    { x: 13.1, y: 4.1 },
  ],
  yellow: [
    { x: 10.9, y: 10.9 },
    { x: 13.1, y: 10.9 },
    { x: 10.9, y: 13.1 },
    { x: 13.1, y: 13.1 },
  ],
  blue: [
    { x: 1.9, y: 10.9 },
    { x: 4.1, y: 10.9 },
    { x: 1.9, y: 13.1 },
    { x: 4.1, y: 13.1 },
  ],
};

/** Where finished tokens rest inside the central finish area. */
export const FINISH_SLOTS: Record<Color, Cell[]> = {
  red: [
    { x: 6.55, y: 7.3 },
    { x: 6.95, y: 7.3 },
    { x: 6.55, y: 7.7 },
    { x: 6.95, y: 7.7 },
  ],
  green: [
    { x: 7.3, y: 6.55 },
    { x: 7.7, y: 6.55 },
    { x: 7.3, y: 6.95 },
    { x: 7.7, y: 6.95 },
  ],
  yellow: [
    { x: 8.05, y: 7.3 },
    { x: 8.45, y: 7.3 },
    { x: 8.05, y: 7.7 },
    { x: 8.45, y: 7.7 },
  ],
  blue: [
    { x: 7.3, y: 8.05 },
    { x: 7.7, y: 8.05 },
    { x: 7.3, y: 8.45 },
    { x: 7.7, y: 8.45 },
  ],
};

/** Ring index for a token step, or null when the step is not on the ring. */
export function ringIndexForStep(color: Color, step: number): number | null {
  if (step < 0 || step > 50) return null;
  return (START_INDEX[color] + step) % RING_LENGTH;
}

/** Board cell (integer grid coordinates) for a token step 0..55. */
export function cellForStep(color: Color, step: number): Cell {
  if (step < 0 || step > FINAL_STEP) throw new Error(`Invalid step ${step}`);
  if (step === FINAL_STEP) return { x: 7, y: 7 };
  const ring = ringIndexForStep(color, step);
  if (ring !== null) return RING[ring]!;
  return HOME_COLUMNS[color][step - 51]!;
}

/** Centre of a grid cell in cell units (0..15). */
export function cellCenter(cell: Cell): Cell {
  return { x: cell.x + 0.5, y: cell.y + 0.5 };
}

export function isSafeStep(color: Color, step: number): boolean {
  const ring = ringIndexForStep(color, step);
  return ring !== null && SAFE_SET.has(ring);
}

/** Seats (colors) used for a given room size. 2p and 3p are spread out. */
export function colorsForRoomSize(size: number): Color[] {
  if (size === 2) return ['red', 'yellow'];
  if (size === 3) return ['red', 'green', 'yellow'];
  if (size === 4) return ['red', 'green', 'yellow', 'blue'];
  throw new Error('Players must be between 2 and 4');
}
