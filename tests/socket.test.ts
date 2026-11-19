import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { io, type Socket } from 'socket.io-client';

import { createLudoServer, type LudoServer } from '../server/src/app.ts';
import { getLegalMoves } from '../shared/src/engine.ts';
import type { Ack, GameEvent, JoinResult, RoomSnapshot } from '../shared/src/protocol.ts';

let server: LudoServer;
let url = '';
let diceQueue: number[] = [];

before(async () => {
  server = createLudoServer({
    serveStatic: false,
    config: {
      dice: () => diceQueue.shift() ?? 1,
      autoPlayDelayMs: 120,
      autoMoveDelayMs: 90,
      passDelayMs: 50,
      lobbySeatTtlMs: 60_000,
      hostTransferMs: 500,
      lobbyTtlMs: 60_000,
      gameTtlMs: 60_000,
      maxRoomAgeMs: 120_000,
      createPerMinute: 1000,
      joinPerMinute: 1000,
    },
  });
  const port = await server.listen(0);
  url = `http://127.0.0.1:${port}`;
});

after(async () => {
  await server.close();
});

interface Client {
  socket: Socket;
  states: RoomSnapshot[];
  events: GameEvent[];
  closedReasons: string[];
  replaced: boolean;
  request<T>(event: string, payload?: unknown): Promise<Ack<T>>;
  last(): RoomSnapshot;
  close(): void;
}

async function connectClient(target = url): Promise<Client> {
  const socket = io(target, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    timeout: 4000,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
  const client: Client = {
    socket,
    states: [],
    events: [],
    closedReasons: [],
    replaced: false,
    request<T>(event: string, payload?: unknown) {
      return new Promise<Ack<T>>((resolve) => {
        if (payload === undefined) {
          (socket as unknown as { emit: (e: string, ack: (r: Ack<T>) => void) => void }).emit(event, resolve);
        } else {
          (socket as unknown as { emit: (e: string, p: unknown, ack: (r: Ack<T>) => void) => void }).emit(
            event,
            payload,
            resolve,
          );
        }
      });
    },
    last() {
      const state = client.states[client.states.length - 1];
      assert.ok(state, 'expected at least one room snapshot');
      return state;
    },
    close() {
      socket.disconnect();
    },
  };
  socket.on('room:state', (state: RoomSnapshot) => client.states.push(state));
  socket.on('game:event', (event: GameEvent) => client.events.push(event));
  socket.on('room:closed', (payload: { reason: string }) => client.closedReasons.push(payload.reason));
  socket.on('session:replaced', () => {
    client.replaced = true;
  });
  return client;
}

async function waitUntil(fn: () => boolean, label: string, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 15));
  }
  throw new Error(`Timed out waiting for: ${label}`);
}

async function createRoom(host: Client, name = 'Host', maxPlayers = 2): Promise<JoinResult> {
  const response = await host.request<JoinResult>('room:create', { name, maxPlayers });
  assert.equal(response.ok, true, JSON.stringify(response));
  return (response as { ok: true; data: JoinResult }).data;
}

async function joinRoom(client: Client, code: string, name: string): Promise<JoinResult> {
  const response = await client.request<JoinResult>('room:join', { code, name });
  assert.equal(response.ok, true, JSON.stringify(response));
  return (response as { ok: true; data: JoinResult }).data;
}

/** Creates a started 2 player room. Returns host + guest clients. */
async function startedGame(): Promise<{ host: Client; guest: Client; join: JoinResult; guestJoin: JoinResult }> {
  diceQueue = [];
  const host = await connectClient();
  const guest = await connectClient();
  const joined = await createRoom(host, 'Host', 2);
  const guestJoined = await joinRoom(guest, joined.snapshot.code, 'Guest');
  await guest.request('room:ready', { ready: true });
  const started = await host.request<{ started: boolean }>('room:start');
  assert.equal(started.ok, true, JSON.stringify(started));
  await waitUntil(() => host.last().phase === 'playing', 'game start');
  return { host, guest, join: joined, guestJoin: guestJoined };
}

// ---------------------------------------------------------------------------

test('creates a room with a shareable code and private secret', async () => {
  diceQueue = [];
  const host = await connectClient();
  try {
    const joined = await createRoom(host, '  Alice  ', 2);
    assert.match(joined.snapshot.code, /^[A-Z2-9]{6}$/);
    assert.ok(joined.playerId.length > 8);
    assert.ok(joined.secret.length >= 20);
    assert.equal(joined.snapshot.phase, 'lobby');
    assert.equal(joined.snapshot.hostId, joined.playerId);
    assert.equal(joined.snapshot.players.length, 1);
    assert.equal(joined.snapshot.players[0]?.name, 'Alice');
    assert.equal(joined.snapshot.players[0]?.color, 'red');
    assert.equal(joined.snapshot.maxPlayers, 2);
    // Secrets must never leak into the public snapshot.
    assert.equal(JSON.stringify(joined.snapshot).includes(joined.secret), false);
  } finally {
    host.close();
  }
});

test('rejects invalid names, sizes and codes', async () => {
  const host = await connectClient();
  try {
    const badName = await host.request('room:create', { name: '   ', maxPlayers: 2 });
    assert.equal(badName.ok, false);
    const badSize = await host.request('room:create', { name: 'Bob', maxPlayers: 5 });
    assert.equal(badSize.ok, false);
    const badCode = await host.request('room:join', { code: 'ZZZZZZ', name: 'Bob' });
    assert.equal(badCode.ok, false);
    assert.equal((badCode as { error: { code: string } }).error.code, 'room-not-found');
    const peek = await host.request<{ exists: boolean }>('room:peek', { code: 'ZZZZZZ' });
    assert.equal(peek.ok, true);
    assert.equal((peek as { ok: true; data: { exists: boolean } }).data.exists, false);
  } finally {
    host.close();
  }
});

test('joins, fills the room and rejects extra players and duplicate names', async () => {
  diceQueue = [];
  const host = await connectClient();
  const guest = await connectClient();
  const stranger = await connectClient();
  try {
    const joined = await createRoom(host, 'Host', 2);
    const code = joined.snapshot.code;

    const peek = await stranger.request<{ exists: boolean; takenSeats: number; phase: string }>('room:peek', { code });
    assert.equal((peek as { ok: true; data: { exists: boolean } }).data.exists, true);
    assert.equal((peek as { ok: true; data: { takenSeats: number } }).data.takenSeats, 1);

    await joinRoom(guest, code, 'Guest');
    await waitUntil(() => host.last().players.length === 2, 'guest joined');
    assert.deepEqual(
      host.last().players.map((p) => p.color),
      ['red', 'yellow'],
    );

    const tooMany = await stranger.request('room:join', { code, name: 'Late' });
    assert.equal(tooMany.ok, false);
    assert.equal((tooMany as { error: { code: string } }).error.code, 'room-full');

    const duplicate = await stranger.request('room:join', { code, name: 'guest' });
    assert.equal(duplicate.ok, false);
    assert.equal((duplicate as { error: { code: string } }).error.code, 'name-taken');
  } finally {
    host.close();
    guest.close();
    stranger.close();
  }
});

test('only the host can start, and every player must be ready', async () => {
  diceQueue = [];
  const host = await connectClient();
  const guest = await connectClient();
  try {
    const joined = await createRoom(host, 'Host', 2);
    await joinRoom(guest, joined.snapshot.code, 'Guest');

    const guestStart = await guest.request('room:start');
    assert.equal(guestStart.ok, false);
    assert.equal((guestStart as { error: { code: string } }).error.code, 'not-host');

    const early = await host.request('room:start');
    assert.equal(early.ok, false);
    assert.equal((early as { error: { code: string } }).error.code, 'not-ready');

    await guest.request('room:ready', { ready: true });
    await waitUntil(() => host.last().players.every((p) => p.ready), 'ready flags');

    const started = await host.request<{ started: boolean }>('room:start');
    assert.equal(started.ok, true);
    await waitUntil(() => guest.last().phase === 'playing', 'playing state');
    assert.equal(guest.last().game?.turnColor, 'red');
    assert.equal(guest.last().game?.dice, null);
  } finally {
    host.close();
    guest.close();
  }
});

test('server rejects out-of-turn and duplicate dice rolls', async () => {
  const { host, guest } = await startedGame();
  try {
    const outOfTurn = await guest.request('game:roll');
    assert.equal(outOfTurn.ok, false);
    assert.equal((outOfTurn as { error: { code: string } }).error.code, 'not-your-turn');

    diceQueue = [6];
    const roll = await host.request<{ dice: number }>('game:roll');
    assert.equal(roll.ok, true);
    assert.equal((roll as { ok: true; data: { dice: number } }).data.dice, 6);

    await waitUntil(() => guest.last().game?.dice === 6, 'dice synced to guest');

    const again = await host.request('game:roll');
    assert.equal(again.ok, false);
    assert.equal((again as { error: { code: string } }).error.code, 'already-rolled');
  } finally {
    host.close();
    guest.close();
  }
});

test('moves are validated and synchronised to every player', async () => {
  const { host, guest } = await startedGame();
  try {
    diceQueue = [6];
    await host.request('game:roll');
    await waitUntil(() => guest.last().game?.dice === 6, 'dice');

    const invalid = await host.request('game:move', { tokenId: 77 });
    assert.equal(invalid.ok, false);

    const moved = await host.request('game:move', { tokenId: 0 });
    assert.equal(moved.ok, true, JSON.stringify(moved));

    await waitUntil(() => guest.last().game?.tokens.red[0] === 0, 'token synced to guest');
    assert.deepEqual(guest.last().game?.tokens.red, [0, -1, -1, -1]);
    // A six keeps the turn with the same player.
    assert.equal(guest.last().game?.turnColor, 'red');
    assert.equal(guest.last().game?.dice, null);

    const moveEvent = guest.events.find((e) => e.type === 'moved');
    assert.ok(moveEvent && moveEvent.type === 'moved');
    assert.deepEqual(moveEvent.path, [0]);
    assert.equal(moveEvent.extraTurn, true);
  } finally {
    host.close();
    guest.close();
  }
});

test('a player who cannot move is skipped automatically', async () => {
  const { host, guest } = await startedGame();
  try {
    diceQueue = [2];
    await host.request('game:roll');
    await waitUntil(() => guest.last().game?.turnColor === 'yellow', 'turn passed to guest');
    assert.equal(guest.last().game?.dice, null);
    assert.ok(guest.events.some((e) => e.type === 'passed' && e.color === 'red'));
  } finally {
    host.close();
    guest.close();
  }
});

test('reconnects with the private secret and keeps the seat', async () => {
  const { host, guest, join, guestJoin } = await startedGame();
  try {
    host.close();
    await waitUntil(() => guest.last().players.find((p) => p.id === join.playerId)?.connected === false, 'host offline');

    const returning = await connectClient();
    const response = await returning.request<JoinResult>('room:rejoin', {
      code: join.snapshot.code,
      secret: join.secret,
    });
    assert.equal(response.ok, true, JSON.stringify(response));
    const data = (response as { ok: true; data: JoinResult }).data;
    assert.equal(data.reconnected, true);
    assert.equal(data.playerId, join.playerId);
    assert.equal(data.snapshot.players.find((p) => p.id === join.playerId)?.connected, true);
    await waitUntil(() => guest.last().players.every((p) => p.connected), 'host back online');

    const wrongSecret = await connectClient();
    const bad = await wrongSecret.request('room:rejoin', {
      code: guestJoin.snapshot.code,
      secret: 'not-a-real-secret-value',
    });
    assert.equal(bad.ok, false);
    assert.equal((bad as { error: { code: string } }).error.code, 'unknown-seat');

    returning.close();
    wrongSecret.close();
  } finally {
    guest.close();
  }
});

test('a disconnected player turn is auto-played by the server', async () => {
  const { host, guest } = await startedGame();
  try {
    diceQueue = [2];
    host.close();
    await waitUntil(() => guest.last().players.find((p) => p.color === 'red')?.connected === false, 'host offline');

    await waitUntil(() => guest.events.some((e) => e.type === 'rolled' && e.auto === true), 'auto roll', 4000);
    await waitUntil(() => guest.last().game?.turnColor === 'yellow', 'auto turn passed', 4000);
    assert.equal(guest.last().game?.tokens.red[0], -1, 'base token cannot move on a 2');
  } finally {
    guest.close();
  }
});

test('host can remove a player from the lobby', async () => {
  diceQueue = [];
  const host = await connectClient();
  const guest = await connectClient();
  try {
    const joined = await createRoom(host, 'Host', 3);
    const guestJoined = await joinRoom(guest, joined.snapshot.code, 'Guest');
    await waitUntil(() => host.last().players.length === 2, 'guest joined');

    const kicked = await host.request<{ kicked: boolean }>('room:kick', { playerId: guestJoined.playerId });
    assert.equal(kicked.ok, true);
    await waitUntil(() => host.last().players.length === 1, 'guest removed');
    await waitUntil(() => guest.closedReasons.length === 1, 'kicked notice');
    assert.match(guest.closedReasons[0]!, /removed/i);
  } finally {
    host.close();
    guest.close();
  }
});

test('a finished game moves the room to the finished phase and allows a rematch', async () => {
  // Use a dedicated server so background auto-play timers from earlier tests
  // cannot consume this game's deterministic dice queue.
  let localDice: number[] = [];
  const local = createLudoServer({
    serveStatic: false,
    config: {
      dice: () => localDice.shift() ?? 1,
      passDelayMs: 50,
      autoPlayDelayMs: 0,
      autoMoveDelayMs: 0,
      createPerMinute: 1000,
      joinPerMinute: 1000,
    },
  });
  const port = await local.listen(0);
  const localUrl = `http://127.0.0.1:${port}`;
  const host = await connectClient(localUrl);
  const guest = await connectClient(localUrl);
  try {
    const joined = await createRoom(host, 'Host', 2);
    await joinRoom(guest, joined.snapshot.code, 'Guest');
    await guest.request('room:ready', { ready: true });
    const started = await host.request('room:start');
    assert.equal(started.ok, true, JSON.stringify(started));
    await waitUntil(() => host.last().phase === 'playing', 'game start');

    // Each token leaves base on a six, advances nine more sixes to step 54,
    // then finishes with an exact 2. Extra turns keep red at the table.
    localDice = [];
    for (let i = 0; i < 4; i += 1) localDice.push(...Array.from({ length: 10 }, () => 6), 2);

    for (let step = 0; step < 100 && host.last().phase === 'playing'; step += 1) {
      const snapshot = host.last();
      const game = snapshot.game;
      assert.ok(game, 'expected a running game');
      const actor = game.turnColor === 'red' ? host : guest;

      if (game.dice === null) {
        const seq = game.logSeq;
        const rolled = await actor.request('game:roll');
        assert.equal(rolled.ok, true, JSON.stringify(rolled));
        await waitUntil(() => host.last().game!.logSeq > seq, 'roll applied');
        continue;
      }

      const legal = getLegalMoves(game);
      assert.ok(
        legal.length > 0,
        `expected a legal move: ${JSON.stringify({
          step,
          turn: game.turnColor,
          dice: game.dice,
          tokens: game.tokens,
          seq: game.logSeq,
          remaining: localDice.slice(0, 8),
        })}`,
      );
      legal.sort((a, b) => a.tokenId - b.tokenId);
      const seq = game.logSeq;
      const moved = await actor.request('game:move', { tokenId: legal[0]!.tokenId });
      assert.equal(moved.ok, true, JSON.stringify(moved));
      await waitUntil(
        () => host.last().game!.logSeq > seq || host.last().phase === 'finished',
        'move applied',
      );
    }

    assert.equal(host.last().phase, 'finished', 'room should switch to the finished phase');
    assert.ok(host.last().game?.winner, 'winner should be set');
    assert.equal(host.last().game?.rankings?.length, 2);
    await waitUntil(() => guest.last().phase === 'finished', 'guest sees the result');

    const rematch = await host.request<{ started: boolean }>('room:rematch');
    assert.equal(rematch.ok, true, JSON.stringify(rematch));
    await waitUntil(() => host.last().phase === 'playing', 'rematch starts');
    assert.equal(host.last().game?.moveCount, 0);
  } finally {
    host.close();
    guest.close();
    await local.close();
  }
});

test('state is consistent across three and four player rooms', async () => {
  for (const size of [3, 4]) {
    diceQueue = [];
    const clients = [await connectClient(), await connectClient(), await connectClient()];
    if (size === 4) clients.push(await connectClient());
    try {
      const joined = await createRoom(clients[0]!, 'P1', size);
      for (let i = 1; i < size; i += 1) {
        await joinRoom(clients[i]!, joined.snapshot.code, `P${i + 1}`);
      }
      await waitUntil(() => clients[0]!.last().players.length === size, 'all players joined');
      for (let i = 1; i < size; i += 1) await clients[i]!.request('room:ready', { ready: true });
      const started = await clients[0]!.request('room:start');
      assert.equal(started.ok, true, JSON.stringify(started));
      await waitUntil(() => clients.every((c) => c.last().phase === 'playing'), 'playing');
      const colors = clients[0]!.last().players.map((p) => p.color);
      assert.deepEqual(
        colors,
        size === 3 ? ['red', 'green', 'yellow'] : ['red', 'green', 'yellow', 'blue'],
      );
      assert.equal(clients[0]!.last().game?.turnColor, 'red');
    } finally {
      clients.forEach((c) => c.close());
    }
  }
});
