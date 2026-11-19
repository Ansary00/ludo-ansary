import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_SIZE,
  FINAL_STEP,
  HOME_COLUMNS,
  RING,
  RING_LENGTH,
  SAFE_RING_INDICES,
  START_INDEX,
  cellForStep,
  colorsForRoomSize,
  ringIndexForStep,
} from '../shared/src/board.ts';
import {
  applyMove,
  chooseAutoMove,
  computeRankings,
  createGame,
  getLegalMoves,
  passTurn,
  rollDice,
} from '../shared/src/engine.ts';
import type { Color, GameState } from '../shared/src/types.ts';

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

test('ring has 52 unique cells inside the board', () => {
  assert.equal(RING_LENGTH, 52);
  assert.equal(RING.length, 52);
  const unique = new Set(RING.map((c) => `${c.x},${c.y}`));
  assert.equal(unique.size, 52);
  for (const cell of RING) {
    assert.ok(cell.x >= 0 && cell.x < BOARD_SIZE);
    assert.ok(cell.y >= 0 && cell.y < BOARD_SIZE);
  }
});

test('ring is a closed loop (orthogonal or diagonal corner hops only)', () => {
  for (let i = 0; i < RING.length; i += 1) {
    const a = RING[i]!;
    const b = RING[(i + 1) % RING.length]!;
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0, `cells ${i} -> ${i + 1} are not adjacent`);
  }
});

test('every start square is the first step of its color', () => {
  for (const color of ['red', 'green', 'yellow', 'blue'] as Color[]) {
    assert.deepEqual(cellForStep(color, 0), RING[START_INDEX[color]]);
    assert.equal(ringIndexForStep(color, 0), START_INDEX[color]);
  }
});

test('home entry ring cell is adjacent to the first home column cell', () => {
  for (const color of ['red', 'green', 'yellow', 'blue'] as Color[]) {
    const entry = RING[ringIndexForStep(color, 50)!]!;
    const home = HOME_COLUMNS[color][0]!;
    assert.equal(Math.abs(entry.x - home.x) + Math.abs(entry.y - home.y), 1, `${color} entry not adjacent`);
    assert.deepEqual(cellForStep(color, 51), home);
    assert.deepEqual(cellForStep(color, FINAL_STEP), { x: 7, y: 7 });
  }
});

test('safe squares are the four starts plus four stars', () => {
  assert.equal(SAFE_RING_INDICES.length, 8);
  for (const color of ['red', 'green', 'yellow', 'blue'] as Color[]) {
    assert.ok(SAFE_RING_INDICES.includes(START_INDEX[color]));
    assert.ok(SAFE_RING_INDICES.includes((START_INDEX[color] + 8) % 52));
  }
});

test('seat colors are spread for 2 and 3 player games', () => {
  assert.deepEqual(colorsForRoomSize(2), ['red', 'yellow']);
  assert.deepEqual(colorsForRoomSize(3), ['red', 'green', 'yellow']);
  assert.deepEqual(colorsForRoomSize(4), ['red', 'green', 'yellow', 'blue']);
  assert.throws(() => colorsForRoomSize(1));
  assert.throws(() => colorsForRoomSize(5));
});

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

function fresh(colors: Color[] = ['red', 'green']): GameState {
  return createGame(colors);
}

test('new game starts with all tokens in base and no dice', () => {
  const state = fresh();
  assert.equal(state.phase, 'playing');
  assert.equal(state.turnColor, 'red');
  assert.equal(state.dice, null);
  assert.deepEqual(state.tokens.red, [-1, -1, -1, -1]);
});

test('a token leaves the base only on a six', () => {
  const state = fresh();
  assert.deepEqual(getLegalMoves(state, 'red', 3), []);
  const sixes = rollDice(state, 6);
  const moves = getLegalMoves(sixes);
  assert.equal(moves.length, 4);
  assert.ok(moves.every((m) => m.from === -1 && m.to === 0));
});

test('tokens move forward by the dice value', () => {
  const state = fresh();
  state.tokens.red = [10, -1, -1, -1];
  state.dice = 4;
  const outcome = applyMove(state, 0);
  assert.equal(outcome.state.tokens.red[0], 14);
  assert.equal(outcome.move.extraTurn, false);
  assert.equal(outcome.state.turnColor, 'green');
});

test('a token cannot overshoot the final home', () => {
  const state = fresh();
  state.tokens.red = [55, FINAL_STEP, FINAL_STEP, FINAL_STEP];
  state.dice = 6;
  assert.deepEqual(getLegalMoves(state), []);
});

test('exact roll finishes a token and returns an extra turn by default', () => {
  const state = fresh();
  state.tokens.red = [55, FINAL_STEP, FINAL_STEP, FINAL_STEP];
  state.dice = 1;
  const outcome = applyMove(state, 0);
  assert.equal(outcome.state.tokens.red[0], FINAL_STEP);
  assert.equal(outcome.move.finished, true);
  assert.equal(outcome.move.gameOver, true);
  assert.equal(outcome.state.winner, 'red');
  assert.equal(outcome.state.phase, 'finished');
  assert.equal(outcome.state.rankings?.[0]?.color, 'red');
  assert.equal(outcome.state.rankings?.length, 2);
});

test('capture sends an opponent token back to base', () => {
  const state = fresh();
  // red step 3 sits on ring 16; green step 46 also sits on ring 16.
  state.tokens.red = [3, -1, -1, -1];
  state.tokens.green = [-1, 46, -1, -1];
  state.dice = 4; // red step 3 -> 7 (ring 20)
  const greenStep = (20 - START_INDEX.green + 52) % 52;
  state.tokens.green[1] = greenStep;
  const outcome = applyMove(state, 0);
  assert.equal(outcome.move.captured.length, 1);
  assert.deepEqual(outcome.move.captured[0], { color: 'green', tokenId: 1 });
  assert.equal(outcome.state.tokens.green[1], -1);
  assert.equal(outcome.state.stats.red.captures, 1);
  assert.equal(outcome.state.stats.green.lost, 1);
  assert.equal(outcome.move.extraTurn, true);
  assert.equal(outcome.state.turnColor, 'red');
});

test('capture is disabled on safe squares by default', () => {
  const state = fresh();
  state.tokens.red = [-1, -1, -1, -1];
  state.dice = 6;
  // green token occupies red's start square: step = 39
  state.tokens.green = [39, -1, -1, -1];
  const outcome = applyMove(state, 0);
  assert.equal(outcome.move.captured.length, 0);
  assert.equal(outcome.state.tokens.green[0], 39);
});

test('capture on safe squares can be enabled as a variant', () => {
  const state = createGame(['red', 'green'], {
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeSixesForfeit: false,
    captureOnSafe: true,
  });
  state.tokens.green = [39, -1, -1, -1];
  state.dice = 6;
  const outcome = applyMove(state, 0);
  assert.equal(outcome.move.captured.length, 1);
});

test('rolling a six grants an extra turn after the move', () => {
  const state = fresh();
  const rolled = rollDice(state, 6);
  const outcome = applyMove(rolled, 0);
  assert.equal(outcome.move.extraTurn, true);
  assert.equal(outcome.state.turnColor, 'red');
  assert.equal(outcome.state.dice, null);
  assert.equal(outcome.state.sixStreak, 1);
});

test('three consecutive sixes forfeit the turn when enabled', () => {
  let state = createGame(['red', 'green'], {
    extraTurnOnSix: true,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeSixesForfeit: true,
    captureOnSafe: false,
  });
  state = rollDice(state, 6);
  state = applyMove(state, 0).state;
  state = rollDice(state, 6);
  state = applyMove(state, 1).state;
  state = rollDice(state, 6);
  assert.equal(state.turnColor, 'green');
  assert.equal(state.dice, null);
  assert.equal(state.lastAction?.type, 'forfeit-sixes');
});

test('a six streak resets after a non-six roll ends the turn', () => {
  let state = createGame(['red', 'green'], {
    extraTurnOnSix: false,
    extraTurnOnCapture: true,
    extraTurnOnHome: true,
    threeSixesForfeit: true,
    captureOnSafe: false,
  });
  state = rollDice(state, 6);
  state = applyMove(state, 0).state; // no extra turn -> green
  assert.equal(state.turnColor, 'green');
  state = rollDice(state, 2);
  assert.equal(state.sixStreak, 0);
});

test('passing the turn skips a player who has finished', () => {
  const state = createGame(['red', 'green', 'yellow']);
  state.tokens.red = [FINAL_STEP, FINAL_STEP, FINAL_STEP, FINAL_STEP];
  state.dice = 6;
  const next = passTurn(state);
  assert.equal(next.turnColor, 'green');
});

test('no legal move when all tokens are home', () => {
  const state = fresh();
  state.tokens.red = [FINAL_STEP, FINAL_STEP, FINAL_STEP, FINAL_STEP];
  state.tokens.green = [FINAL_STEP, FINAL_STEP, FINAL_STEP, FINAL_STEP];
  assert.deepEqual(getLegalMoves(state, 'red', 6), []);
});

test('auto move prefers a capture', () => {
  const state = fresh();
  state.tokens.red = [3, 20, -1, -1];
  state.tokens.green = [-1, (20 - START_INDEX.green + 52) % 52, -1, -1];
  state.dice = 4; // token 0 captures at ring 20, token 1 moves to 24
  assert.equal(chooseAutoMove(state), 0);
});

test('rankings order finishers first, then by progress', () => {
  const state = createGame(['red', 'green', 'yellow', 'blue']);
  state.finishedOrder = ['yellow'];
  state.tokens.yellow = [56, 56, 56, 56];
  state.tokens.red = [20, 20, -1, -1];
  state.tokens.green = [5, -1, -1, -1];
  state.tokens.blue = [40, 40, 40, 40];
  const rankings = computeRankings(state);
  assert.deepEqual(
    rankings.map((r) => r.color),
    ['yellow', 'blue', 'red', 'green'],
  );
  assert.deepEqual(
    rankings.map((r) => r.rank),
    [1, 2, 3, 4],
  );
});

test('illegal actions are rejected', () => {
  const state = fresh();
  assert.throws(() => applyMove(state, 0), /Roll the dice first/);
  const rolled = rollDice(state, 3);
  assert.throws(() => rollDice(rolled, 4), /already been rolled/);
  assert.throws(() => applyMove(rolled, 0), /cannot move/);
  assert.throws(() => applyMove(rolled, 9), /Unknown token/);
});

test('simulated games always reach a winner', () => {
  const sizes = [
    ['red', 'yellow'],
    ['red', 'green', 'yellow'],
    ['red', 'green', 'yellow', 'blue'],
  ] as Color[][];
  for (const colors of sizes) {
    for (let round = 0; round < 6; round += 1) {
      let state = createGame(colors);
      let guard = 0;
      while (state.phase === 'playing' && guard < 30_000) {
        guard += 1;
        if (state.dice === null) {
          state = rollDice(state, 1 + Math.floor(Math.random() * 6));
          continue;
        }
        const moves = getLegalMoves(state);
        if (moves.length === 0) {
          state = passTurn(state);
          continue;
        }
        const pick = moves[Math.floor(Math.random() * moves.length)]!;
        state = applyMove(state, pick.tokenId).state;
      }
      assert.equal(state.phase, 'finished', `game did not finish for ${colors.length} players`);
      assert.ok(state.winner, 'winner missing');
      assert.equal(state.rankings?.length, colors.length);
      assert.equal(state.rankings?.[0]?.color, state.winner);
      assert.equal(state.rankings?.[0]?.tokensHome, 4);
    }
  }
});
