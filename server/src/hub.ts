import type { Server, Socket } from 'socket.io';

import {
  GameError,
  applyMove,
  chooseAutoMove,
  colorsForRoomSize,
  createGame,
  getLegalMoves,
  normalizeRules,
  passTurn,
  rollDice,
} from '../../shared/src/index.ts';
import type {
  Ack,
  ClientToServerEvents,
  GameEvent,
  GameState,
  InterServerEvents,
  JoinResult,
  PeekInfo,
  PublicPlayer,
  RoomSnapshot,
  Rules,
  ServerToClientEvents,
  SocketData,
  Color,
} from '../../shared/src/index.ts';
import { RateLimiter, generateRoomCode, normalizeCode, randomId, randomSecret, rollDie, sanitizeName } from './util.ts';

export type HubIO = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type HubSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface HubConfig {
  autoPlayDelayMs: number;
  autoMoveDelayMs: number;
  passDelayMs: number;
  lobbyTtlMs: number;
  gameTtlMs: number;
  hostTransferMs: number;
  lobbySeatTtlMs: number;
  maxRoomAgeMs: number;
  createPerMinute: number;
  joinPerMinute: number;
  now?: () => number;
  dice?: () => number;
}

interface RoomPlayer extends PublicPlayer {
  secret: string;
  socketId: string | null;
  disconnectedAt: number | null;
}

interface Room {
  code: string;
  maxPlayers: number;
  players: RoomPlayer[];
  hostId: string;
  phase: 'lobby' | 'playing' | 'finished';
  rules: Rules;
  game: GameState | null;
  createdAt: number;
  lastActivity: number;
  autoPlayAt: number | null;
  autoTimer: NodeJS.Timeout | null;
  passTimer: NodeJS.Timeout | null;
  hostTimer: NodeJS.Timeout | null;
}

function ok<T>(data: T): Ack<T> {
  return { ok: true, data };
}

function fail<T>(code: string, message: string): Ack<T> {
  return { ok: false, error: { code, message } };
}

function errorMessage(error: unknown): string {
  if (error instanceof GameError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected server error';
}

function errorCode(error: unknown): string {
  if (error instanceof GameError) return error.code;
  return 'server-error';
}

export class GameHub {
  private rooms = new Map<string, Room>();
  private readonly io: HubIO;
  private readonly config: HubConfig;
  private createLimiter: RateLimiter;
  private joinLimiter: RateLimiter;

  constructor(io: HubIO, config: HubConfig) {
    this.io = io;
    this.config = config;
    this.createLimiter = new RateLimiter(config.createPerMinute, 60_000);
    this.joinLimiter = new RateLimiter(config.joinPerMinute, 60_000);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get playerCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.players.filter((p) => p.connected).length;
    }
    return count;
  }

  // -------------------------------------------------------------------------
  // Room lifecycle
  // -------------------------------------------------------------------------

  create(socket: HubSocket, payload: { name: unknown; maxPlayers: unknown; rules?: Partial<Rules> }): Ack<JoinResult> {
    const now = this.now();
    if (socket.data.code) return fail('already-in-room', 'You are already in a room. Leave it first.');

    const name = sanitizeName(payload?.name);
    if (!name) return fail('invalid-name', 'Please enter a player name (1-16 characters).');

    const maxPlayers = Number(payload?.maxPlayers);
    if (![2, 3, 4].includes(maxPlayers)) {
      return fail('invalid-size', 'Choose 2, 3 or 4 players.');
    }
    if (!this.createLimiter.allow(`create:${socket.handshake.address}`, now)) {
      return fail('rate-limited', 'Too many rooms created. Please wait a minute and try again.');
    }

    const code = this.uniqueCode();
    const colors = colorsForRoomSize(maxPlayers);
    const player: RoomPlayer = {
      id: randomId(),
      secret: randomSecret(),
      seat: 0,
      name,
      color: colors[0]!,
      connected: true,
      ready: true,
      isHost: true,
      joinedAt: now,
      autoPlay: false,
      socketId: socket.id,
      disconnectedAt: null,
    };
    const room: Room = {
      code,
      maxPlayers,
      players: [player],
      hostId: player.id,
      phase: 'lobby',
      rules: normalizeRules(payload?.rules),
      game: null,
      createdAt: now,
      lastActivity: now,
      autoPlayAt: null,
      autoTimer: null,
      passTimer: null,
      hostTimer: null,
    };
    this.rooms.set(code, room);
    this.attach(socket, room, player);
    this.broadcast(room);

    return ok(this.joinResult(player, room, false));
  }

  join(socket: HubSocket, payload: { code: unknown; name: unknown }): Ack<JoinResult> {
    const now = this.now();
    if (socket.data.code) return fail('already-in-room', 'You are already in a room. Leave it first.');

    const code = normalizeCode(payload?.code);
    if (!code) return fail('invalid-code', 'Enter a valid room code.');
    const room = this.rooms.get(code);
    if (!room) return fail('room-not-found', 'That room does not exist. Check the invitation link.');

    const name = sanitizeName(payload?.name);
    if (!name) return fail('invalid-name', 'Please enter a player name (1-16 characters).');

    if (!this.joinLimiter.allow(`join:${socket.handshake.address}`, now)) {
      return fail('rate-limited', 'Too many join attempts. Please wait a minute.');
    }

    if (room.phase !== 'lobby') {
      return fail('game-in-progress', 'This game has already started.');
    }
    if (room.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return fail('name-taken', 'That name is already taken in this room.');
    }
    if (room.players.length >= room.maxPlayers) {
      return fail('room-full', 'This room is full.');
    }

    const usedSeats = new Set(room.players.map((p) => p.seat));
    let seat = 0;
    while (usedSeats.has(seat)) seat += 1;
    const colors = colorsForRoomSize(room.maxPlayers);
    const color = colors[seat];
    if (!color) return fail('room-full', 'This room is full.');

    const player: RoomPlayer = {
      id: randomId(),
      secret: randomSecret(),
      seat,
      name,
      color,
      connected: true,
      ready: false,
      isHost: false,
      joinedAt: now,
      autoPlay: false,
      socketId: socket.id,
      disconnectedAt: null,
    };
    room.players.push(player);
    room.players.sort((a, b) => a.seat - b.seat);
    room.lastActivity = now;
    this.attach(socket, room, player);
    this.broadcast(room);
    return ok(this.joinResult(player, room, false));
  }

  rejoin(socket: HubSocket, payload: { code: unknown; secret: unknown }): Ack<JoinResult> {
    if (socket.data.code) this.detachSocket(socket, false);

    const code = normalizeCode(payload?.code);
    if (!code) return fail('invalid-code', 'Enter a valid room code.');
    if (typeof payload?.secret !== 'string' || payload.secret.length < 10) {
      return fail('invalid-secret', 'This device is missing the room credentials.');
    }
    const room = this.rooms.get(code);
    if (!room) return fail('room-not-found', 'This room no longer exists.');

    const player = room.players.find((p) => p.secret === payload.secret);
    if (!player) return fail('unknown-seat', 'Your seat is no longer available in this room.');

    if (player.socketId) {
      const previous = this.io.sockets.sockets.get(player.socketId);
      if (previous) {
        previous.emit('session:replaced');
        previous.leave(room.code);
        previous.data.code = null;
        previous.data.playerId = null;
      }
    }

    this.attach(socket, room, player);
    room.lastActivity = this.now();
    this.clearHostTimer(room);
    this.broadcast(room);
    return ok(this.joinResult(player, room, true));
  }

  peek(payload: { code: unknown }): Ack<PeekInfo> {
    const code = normalizeCode(payload?.code);
    if (!code) return fail('invalid-code', 'Enter a valid room code.');
    const room = this.rooms.get(code);
    if (!room) {
      return ok<PeekInfo>({ code, exists: false, phase: null, maxPlayers: 0, takenSeats: 0, players: [] });
    }
    return ok<PeekInfo>({
      code,
      exists: true,
      phase: room.phase,
      maxPlayers: room.maxPlayers,
      takenSeats: room.players.length,
      players: room.players.map((p) => ({ name: p.name, color: p.color, connected: p.connected })),
    });
  }

  leave(socket: HubSocket): Ack<{ left: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player) {
      socket.data.code = null;
      socket.data.playerId = null;
      return ok({ left: true });
    }
    this.clearPending(room);
    socket.leave(room.code);
    socket.data.code = null;
    socket.data.playerId = null;
    player.socketId = null;

    if (room.phase === 'lobby') {
      this.removePlayer(room, player);
      if (room.players.length === 0) {
        this.destroyRoom(room, 'The room was closed.');
        return ok({ left: true });
      }
      this.broadcast(room);
      return ok({ left: true });
    }

    player.connected = false;
    player.disconnectedAt = this.now();
    room.lastActivity = this.now();
    this.broadcast(room);
    return ok({ left: true });
  }

  setReady(socket: HubSocket, ready: boolean): Ack<{ ready: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player) return fail('not-in-room', 'You are not in a room.');
    if (room.phase !== 'lobby') return fail('invalid-phase', 'The game has already started.');
    player.ready = player.isHost ? true : Boolean(ready);
    room.lastActivity = this.now();
    this.broadcast(room);
    return ok({ ready: player.ready });
  }

  start(socket: HubSocket): Ack<{ started: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player) return fail('not-in-room', 'You are not in a room.');
    if (room.hostId !== player.id) return fail('not-host', 'Only the host can start the game.');
    if (room.phase !== 'lobby') return fail('invalid-phase', 'The game has already started.');
    if (room.players.length !== room.maxPlayers) {
      return fail('not-ready', 'All player slots must be filled before starting.');
    }
    if (room.players.some((p) => !p.connected)) {
      return fail('not-ready', 'A player is disconnected. Wait for them or remove them.');
    }
    if (room.players.some((p) => !p.ready)) {
      return fail('not-ready', 'All players must be ready.');
    }

    const colors = room.players.map((p) => p.color);
    room.game = createGame(colors, room.rules);
    room.phase = 'playing';
    room.players.forEach((p) => {
      p.ready = true;
      p.autoPlay = false;
    });
    room.lastActivity = this.now();
    this.clearPending(room);
    this.emitEvent(room, { type: 'started', color: colors[0]! });
    this.broadcast(room);
    return ok({ started: true });
  }

  rematch(socket: HubSocket): Ack<{ started: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player) return fail('not-in-room', 'You are not in a room.');
    if (room.hostId !== player.id) return fail('not-host', 'Only the host can start a rematch.');
    if (room.phase !== 'finished') return fail('invalid-phase', 'The game is still running.');

    this.clearPending(room);
    const everyoneHere =
      room.players.length === room.maxPlayers && room.players.every((p) => p.connected);

    if (everyoneHere) {
      const colors = room.players.map((p) => p.color);
      room.game = createGame(colors, room.rules);
      room.phase = 'playing';
      room.players.forEach((p) => {
        p.ready = true;
        p.autoPlay = false;
      });
      room.lastActivity = this.now();
      this.emitEvent(room, { type: 'rematch', color: colors[0]! });
      this.emitEvent(room, { type: 'started', color: colors[0]! });
      this.broadcast(room);
      return ok({ started: true });
    }

    room.phase = 'lobby';
    room.game = null;
    room.players.forEach((p) => {
      p.ready = p.isHost;
      p.autoPlay = false;
    });
    room.lastActivity = this.now();
    this.emitEvent(room, { type: 'system', message: 'Back to the lobby — fill the empty seats and start again.', tone: 'info' });
    this.broadcast(room);
    return ok({ started: false });
  }

  kick(socket: HubSocket, playerId: string): Ack<{ kicked: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player) return fail('not-in-room', 'You are not in a room.');
    if (room.hostId !== player.id) return fail('not-host', 'Only the host can remove a player.');
    if (room.phase !== 'lobby') return fail('invalid-phase', 'You can only remove players in the lobby.');
    const target = room.players.find((p) => p.id === playerId);
    if (!target) return fail('player-not-found', 'That player is no longer in the room.');
    if (target.id === player.id) return fail('invalid-target', 'The host cannot be removed.');

    if (target.socketId) {
      const targetSocket = this.io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.emit('room:closed', { reason: 'You were removed from the room by the host.' });
        targetSocket.leave(room.code);
        targetSocket.data.code = null;
        targetSocket.data.playerId = null;
      }
    }
    this.removePlayer(room, target);
    room.lastActivity = this.now();
    this.broadcast(room);
    return ok({ kicked: true });
  }

  // -------------------------------------------------------------------------
  // Game actions
  // -------------------------------------------------------------------------

  roll(socket: HubSocket): Ack<{ dice: number }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player || !room.game) return fail('not-in-room', 'You are not in a running game.');
    if (room.phase !== 'playing') return fail('invalid-phase', 'The game is not running.');
    if (room.game.turnColor !== player.color) return fail('not-your-turn', 'It is not your turn.');
    if (room.game.dice !== null) return fail('already-rolled', 'You already rolled the dice.');

    this.clearPending(room);
    const color = room.game.turnColor;
    const dice = this.rollValue();
    let next: GameState;
    try {
      next = rollDice(room.game, dice);
    } catch (error) {
      return fail(errorCode(error), errorMessage(error));
    }
    room.game = next;
    room.lastActivity = this.now();

    this.emitEvent(room, { type: 'rolled', color, dice });
    if (next.lastAction?.type === 'forfeit-sixes') {
      this.emitEvent(room, { type: 'forfeit', color });
    }
    this.broadcast(room);

    if (next.turnColor === color && next.dice !== null && getLegalMoves(next).length === 0) {
      this.schedulePass(room, color);
    }
    return ok({ dice });
  }

  move(socket: HubSocket, tokenId: unknown): Ack<{ moved: boolean }> {
    const { room, player } = this.resolve(socket);
    if (!room || !player || !room.game) return fail('not-in-room', 'You are not in a running game.');
    if (room.phase !== 'playing') return fail('invalid-phase', 'The game is not running.');
    if (room.game.turnColor !== player.color) return fail('not-your-turn', 'It is not your turn.');
    if (room.game.dice === null) return fail('dice-not-rolled', 'Roll the dice first.');

    const id = Number(tokenId);
    if (!Number.isInteger(id)) return fail('invalid-token', 'Unknown token.');

    this.clearPending(room);
    let outcome;
    try {
      outcome = applyMove(room.game, id);
    } catch (error) {
      return fail(errorCode(error), errorMessage(error));
    }
    room.game = outcome.state;
    room.lastActivity = this.now();
    if (outcome.state.phase === 'finished') {
      room.phase = 'finished';
      this.clearPending(room);
    }

    const { move } = outcome;
    this.emitEvent(room, {
      type: 'moved',
      color: player.color,
      tokenId: move.tokenId,
      from: move.from,
      to: move.to,
      path: move.from < 0 ? [0] : Array.from({ length: move.to - move.from }, (_, i) => move.from + i + 1),
      captured: move.captured,
      finished: move.finished,
      extraTurn: move.extraTurn,
    });
    if (move.gameOver && outcome.state.rankings) {
      this.emitEvent(room, {
        type: 'game-over',
        winner: move.winner ?? player.color,
        rankings: outcome.state.rankings,
      });
    }
    this.broadcast(room);
    return ok({ moved: true });
  }

  // -------------------------------------------------------------------------
  // Connections, timers and cleanup
  // -------------------------------------------------------------------------

  disconnect(socket: HubSocket): void {
    const { room, player } = this.resolve(socket);
    socket.data.code = null;
    socket.data.playerId = null;
    if (!room || !player) return;
    if (player.socketId !== socket.id) return;

    player.socketId = null;
    player.connected = false;
    player.disconnectedAt = this.now();
    player.autoPlay = false;
    if (room.hostId === player.id) this.scheduleHostTransfer(room);
    this.broadcast(room);
  }

  sweep(): void {
    const now = this.now();
    for (const room of [...this.rooms.values()]) {
      let changed = false;

      if (room.phase === 'lobby') {
        for (const player of [...room.players]) {
          if (!player.connected && player.disconnectedAt && now - player.disconnectedAt > this.config.lobbySeatTtlMs) {
            this.removePlayer(room, player);
            changed = true;
          }
        }
        if (room.players.length === 0) {
          this.destroyRoom(room, 'The room expired.');
          continue;
        }
      }

      const anyConnected = room.players.some((p) => p.connected);
      const idleFor = now - room.lastActivity;
      const ttl = room.phase === 'playing' ? this.config.gameTtlMs : this.config.lobbyTtlMs;
      if (!anyConnected && idleFor > ttl) {
        this.destroyRoom(room, 'The room expired because everyone left.');
        continue;
      }
      if (now - room.createdAt > this.config.maxRoomAgeMs) {
        this.destroyRoom(room, 'The room reached its maximum lifetime.');
        continue;
      }
      if (changed) this.broadcast(room);
    }

    this.createLimiter.sweep(now);
    this.joinLimiter.sweep(now);
  }

  destroyRoom(room: Room, reason: string): void {
    this.clearPending(room);
    this.clearHostTimer(room);
    this.io.to(room.code).emit('room:closed', { reason });
    this.io.socketsLeave(room.code);
    this.rooms.delete(room.code);
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private now(): number {
    return this.config.now ? this.config.now() : Date.now();
  }

  private rollValue(): number {
    return this.config.dice ? this.config.dice() : rollDie();
  }

  private uniqueCode(): string {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const code = generateRoomCode();
      if (!this.rooms.has(code)) return code;
    }
    // Extremely unlikely; widen the code instead of failing.
    return generateRoomCode(8);
  }

  private resolve(socket: HubSocket): { room: Room | null; player: RoomPlayer | null } {
    const code = socket.data.code;
    const playerId = socket.data.playerId;
    if (!code || !playerId) return { room: null, player: null };
    const room = this.rooms.get(code) ?? null;
    if (!room) return { room: null, player: null };
    const player = room.players.find((p) => p.id === playerId) ?? null;
    return { room, player };
  }

  private attach(socket: HubSocket, room: Room, player: RoomPlayer): void {
    player.socketId = socket.id;
    player.connected = true;
    player.disconnectedAt = null;
    player.autoPlay = false;
    socket.data.code = room.code;
    socket.data.playerId = player.id;
    socket.join(room.code);
  }

  private detachSocket(socket: HubSocket, markDisconnected: boolean): void {
    const { room, player } = this.resolve(socket);
    if (room && player && player.socketId === socket.id) {
      player.socketId = null;
      if (markDisconnected) {
        player.connected = false;
        player.disconnectedAt = this.now();
      }
      socket.leave(room.code);
    }
    socket.data.code = null;
    socket.data.playerId = null;
  }

  private removePlayer(room: Room, player: RoomPlayer): void {
    const index = room.players.findIndex((p) => p.id === player.id);
    if (index >= 0) room.players.splice(index, 1);
    if (room.players.length > 0 && room.hostId === player.id) {
      const nextHost = room.players.find((p) => p.connected) ?? room.players[0]!;
      room.hostId = nextHost.id;
      room.players.forEach((p) => {
        p.isHost = p.id === room.hostId;
        if (p.isHost) p.ready = true;
      });
      this.emitEvent(room, { type: 'system', message: `${nextHost.name} is now the host.`, tone: 'info' });
    }
  }

  private scheduleHostTransfer(room: Room): void {
    this.clearHostTimer(room);
    room.hostTimer = setTimeout(() => {
      room.hostTimer = null;
      if (room.phase === 'playing') return;
      const host = room.players.find((p) => p.id === room.hostId);
      if (!host || host.connected) return;
      const nextHost = room.players.find((p) => p.connected);
      if (!nextHost) return;
      room.hostId = nextHost.id;
      room.players.forEach((p) => {
        p.isHost = p.id === room.hostId;
        if (p.isHost) p.ready = true;
      });
      room.lastActivity = this.now();
      this.emitEvent(room, { type: 'system', message: `${nextHost.name} is now the host.`, tone: 'info' });
      this.broadcast(room);
    }, this.config.hostTransferMs);
    room.hostTimer.unref?.();
  }

  private clearHostTimer(room: Room): void {
    if (room.hostTimer) {
      clearTimeout(room.hostTimer);
      room.hostTimer = null;
    }
  }

  private schedulePass(room: Room, color: Color): void {
    this.clearPassTimer(room);
    room.passTimer = setTimeout(() => {
      room.passTimer = null;
      if (room.phase !== 'playing' || !room.game) return;
      if (room.game.turnColor !== color || room.game.dice === null) return;
      room.game = passTurn(room.game);
      room.lastActivity = this.now();
      this.emitEvent(room, { type: 'passed', color, reason: 'no-moves' });
      this.broadcast(room);
    }, this.config.passDelayMs);
    room.passTimer.unref?.();
  }

  private clearPassTimer(room: Room): void {
    if (room.passTimer) {
      clearTimeout(room.passTimer);
      room.passTimer = null;
    }
  }

  private clearAutoTimer(room: Room): void {
    if (room.autoTimer) {
      clearTimeout(room.autoTimer);
      room.autoTimer = null;
    }
    room.autoPlayAt = null;
  }

  private clearPending(room: Room): void {
    this.clearPassTimer(room);
    this.clearAutoTimer(room);
  }

  private broadcast(room: Room): void {
    if (!this.rooms.has(room.code)) return;
    this.scheduleAutoPlay(room);
    this.io.to(room.code).emit('room:state', this.snapshot(room));
  }

  private scheduleAutoPlay(room: Room): void {
    this.clearAutoTimer(room);
    if (room.phase !== 'playing' || !room.game) return;
    const current = room.players.find((p) => p.color === room.game!.turnColor);
    if (!current || current.connected) return;
    const delay = room.game.dice === null ? this.config.autoPlayDelayMs : this.config.autoMoveDelayMs;
    if (delay <= 0) return;
    room.autoPlayAt = this.now() + delay;
    room.autoTimer = setTimeout(() => {
      room.autoTimer = null;
      room.autoPlayAt = null;
      this.autoPlay(room);
    }, delay);
    room.autoTimer.unref?.();
  }

  private autoPlay(room: Room): void {
    if (room.phase !== 'playing' || !room.game) return;
    const game = room.game;
    const current = room.players.find((p) => p.color === game.turnColor);
    if (!current || current.connected) return;
    current.autoPlay = true;
    room.lastActivity = this.now();

    if (game.dice === null) {
      const dice = this.rollValue();
      const color = game.turnColor;
      try {
        room.game = rollDice(game, dice);
      } catch {
        return;
      }
      this.emitEvent(room, { type: 'rolled', color, dice, auto: true });
      if (room.game.lastAction?.type === 'forfeit-sixes') {
        this.emitEvent(room, { type: 'forfeit', color });
      }
      this.broadcast(room);
      if (room.game.turnColor === color && room.game.dice !== null) {
        if (getLegalMoves(room.game).length === 0) this.schedulePass(room, color);
      }
      return;
    }

    if (getLegalMoves(room.game).length === 0) return; // pass timer handles it
    const tokenId = chooseAutoMove(room.game);
    if (tokenId === null) return;

    try {
      const outcome = applyMove(room.game, tokenId);
      room.game = outcome.state;
      if (outcome.state.phase === 'finished') {
        room.phase = 'finished';
        this.clearPending(room);
      }
      this.emitEvent(room, {
        type: 'moved',
        color: current.color,
        tokenId,
        from: outcome.move.from,
        to: outcome.move.to,
        path:
          outcome.move.from < 0
            ? [0]
            : Array.from({ length: outcome.move.to - outcome.move.from }, (_, i) => outcome.move.from + i + 1),
        captured: outcome.move.captured,
        finished: outcome.move.finished,
        extraTurn: outcome.move.extraTurn,
        auto: true,
      });
      if (outcome.move.gameOver && outcome.state.rankings) {
        this.emitEvent(room, {
          type: 'game-over',
          winner: outcome.move.winner ?? current.color,
          rankings: outcome.state.rankings,
        });
      }
      this.broadcast(room);
    } catch {
      // Ignore and let the sweep/pass logic recover on the next tick.
    }
  }

  private emitEvent(room: Room, event: GameEvent): void {
    this.io.to(room.code).emit('game:event', event);
  }

  private joinResult(player: RoomPlayer, room: Room, reconnected: boolean): JoinResult {
    return {
      playerId: player.id,
      secret: player.secret,
      snapshot: this.snapshot(room),
      reconnected,
    };
  }

  private snapshot(room: Room): RoomSnapshot {
    return {
      code: room.code,
      phase: room.phase,
      maxPlayers: room.maxPlayers,
      hostId: room.hostId,
      players: room.players.map((p) => ({
        id: p.id,
        seat: p.seat,
        name: p.name,
        color: p.color,
        connected: p.connected,
        isHost: p.id === room.hostId,
        ready: p.ready,
        joinedAt: p.joinedAt,
        autoPlay: !p.connected,
      })),
      rules: room.rules,
      game: room.game,
      createdAt: room.createdAt,
      lastActivity: room.lastActivity,
      serverTime: this.now(),
      autoPlayAt: room.autoPlayAt,
    };
  }
}
