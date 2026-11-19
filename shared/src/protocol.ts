import type { Color, GameState, Ranking, Rules } from './types.ts';

export type RoomPhase = 'lobby' | 'playing' | 'finished';

export interface PublicPlayer {
  id: string;
  seat: number;
  name: string;
  color: Color;
  connected: boolean;
  isHost: boolean;
  ready: boolean;
  joinedAt: number;
  /** True when the server is currently playing this seat automatically. */
  autoPlay: boolean;
}

export interface RoomSnapshot {
  code: string;
  phase: RoomPhase;
  maxPlayers: number;
  hostId: string;
  players: PublicPlayer[];
  rules: Rules;
  game: GameState | null;
  createdAt: number;
  lastActivity: number;
  serverTime: number;
  /** Epoch ms when a disconnected player's turn will be auto-played, if any. */
  autoPlayAt: number | null;
}

export interface PeekInfo {
  code: string;
  exists: boolean;
  phase: RoomPhase | null;
  maxPlayers: number;
  takenSeats: number;
  players: { name: string; color: Color; connected: boolean }[];
}

export interface JoinResult {
  playerId: string;
  /** Private reconnect secret. Never broadcast to other players. */
  secret: string;
  snapshot: RoomSnapshot;
  reconnected: boolean;
}

export interface ErrorInfo {
  code: string;
  message: string;
}

export type Ack<T> = { ok: true; data: T } | { ok: false; error: ErrorInfo };

export type GameEvent =
  | { type: 'started'; color: Color }
  | { type: 'rolled'; color: Color; dice: number; auto?: boolean }
  | {
      type: 'moved';
      color: Color;
      tokenId: number;
      from: number;
      to: number;
      path: number[];
      captured: { color: Color; tokenId: number }[];
      finished: boolean;
      extraTurn: boolean;
      auto?: boolean;
    }
  | { type: 'passed'; color: Color; reason: 'no-moves'; auto?: boolean }
  | { type: 'forfeit'; color: Color }
  | { type: 'game-over'; winner: Color; rankings: Ranking[] }
  | { type: 'kicked'; playerId: string; name: string }
  | { type: 'rematch'; color: Color | null }
  | { type: 'system'; message: string; tone: 'info' | 'warn' };

export interface ServerNotice {
  tone: 'info' | 'warn' | 'error';
  message: string;
}

export interface ClientToServerEvents {
  'room:create': (
    payload: { name: string; maxPlayers: number; rules?: Partial<Rules> },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:join': (
    payload: { code: string; name: string },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:rejoin': (
    payload: { code: string; secret: string },
    ack: (res: Ack<JoinResult>) => void,
  ) => void;
  'room:peek': (payload: { code: string }, ack: (res: Ack<PeekInfo>) => void) => void;
  'room:leave': (ack: (res: Ack<{ left: boolean }>) => void) => void;
  'room:ready': (payload: { ready: boolean }, ack: (res: Ack<{ ready: boolean }>) => void) => void;
  'room:start': (ack: (res: Ack<{ started: boolean }>) => void) => void;
  'room:rematch': (ack: (res: Ack<{ started: boolean }>) => void) => void;
  'room:kick': (
    payload: { playerId: string },
    ack: (res: Ack<{ kicked: boolean }>) => void,
  ) => void;
  'game:roll': (ack: (res: Ack<{ dice: number }>) => void) => void;
  'game:move': (
    payload: { tokenId: number },
    ack: (res: Ack<{ moved: boolean }>) => void,
  ) => void;
  'net:ping': (ack: (res: { ok: true; t: number }) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (snapshot: RoomSnapshot) => void;
  'game:event': (event: GameEvent) => void;
  'room:closed': (payload: { reason: string }) => void;
  'session:replaced': () => void;
  notice: (notice: ServerNotice) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  code: string | null;
  playerId: string | null;
}
