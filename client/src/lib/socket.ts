import { io, type Socket } from 'socket.io-client';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from '@shared/protocol.ts';

const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim();

/**
 * One shared socket for the whole app. Same-origin by default (the Node server
 * also serves the built client). Set VITE_SERVER_URL when the client and server
 * are deployed on different free hosts.
 */
export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SERVER_URL || undefined, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.4,
  timeout: 9000,
});

socket.on('connect_error', (error) => {
  if (import.meta.env.DEV) console.warn('[socket] connect error:', error.message);
});

type Emitter = {
  emit: (event: string, ...args: unknown[]) => void;
};

/** Promise wrapper around a Socket.IO acknowledgement with a timeout. */
export function request<T>(event: string, payload?: unknown, timeoutMs = 12_000): Promise<Ack<T>> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({
        ok: false,
        error: { code: 'timeout', message: 'The server did not respond. Check your connection and try again.' },
      });
    }, timeoutMs);

    const done = (result: Ack<T>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };

    try {
      const emitter = socket as unknown as Emitter;
      if (payload === undefined) emitter.emit(event, done);
      else emitter.emit(event, payload, done);
    } catch {
      done({ ok: false, error: { code: 'socket-error', message: 'Could not reach the game server.' } });
    }
  });
}

export function waitForConnection(timeoutMs = 12_000): Promise<boolean> {
  if (socket.connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      socket.off('connect', onConnect);
      resolve(value);
    };
    const onConnect = () => finish(true);
    const timer = window.setTimeout(() => finish(socket.connected), timeoutMs);
    socket.on('connect', onConnect);
    if (!socket.active) socket.connect();
  });
}
