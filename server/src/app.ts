import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import express from 'express';
import { Server } from 'socket.io';

import type {
  ClientToServerEvents,
  InterServerEvents,
  ServerToClientEvents,
  SocketData,
} from '../../shared/src/index.ts';
import { GameHub, type HubConfig } from './hub.ts';
import { RateLimiter } from './util.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DEFAULT_HUB_CONFIG: HubConfig = {
  autoPlayDelayMs: 12_000,
  autoMoveDelayMs: 2_600,
  passDelayMs: 1_400,
  lobbyTtlMs: 30 * 60_000,
  gameTtlMs: 2 * 60 * 60_000,
  hostTransferMs: 60_000,
  lobbySeatTtlMs: 2 * 60_000,
  maxRoomAgeMs: 12 * 60 * 60_000,
  createPerMinute: 12,
  joinPerMinute: 60,
};

export interface CreateLudoServerOptions {
  config?: Partial<HubConfig>;
  corsOrigins?: string[];
  serveStatic?: boolean;
  clientDist?: string;
}

export interface LudoServer {
  app: express.Express;
  httpServer: http.Server;
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  hub: GameHub;
  listen: (port?: number) => Promise<number>;
  close: () => Promise<void>;
}

export function createLudoServer(options: CreateLudoServerOptions = {}): LudoServer {
  const config: HubConfig = { ...DEFAULT_HUB_CONFIG, ...options.config };
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(express.json({ limit: '16kb' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  const httpServer = http.createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
    cors: {
      origin: options.corsOrigins && options.corsOrigins.length > 0 ? options.corsOrigins : true,
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 64_000,
    pingInterval: 20_000,
    pingTimeout: 25_000,
    connectionStateRecovery: {
      maxDisconnectionDuration: 60_000,
      skipMiddlewares: true,
    },
  });

  const hub = new GameHub(io, config);
  const socketLimiter = new RateLimiter(120, 10_000);

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      uptimeSeconds: Math.round(process.uptime()),
      rooms: hub.roomCount,
      players: hub.playerCount,
      now: Date.now(),
    });
  });

  app.get('/api/rooms/:code', (req, res) => {
    const result = hub.peek({ code: req.params.code });
    if (!result.ok) {
      res.status(400).json(result.error);
      return;
    }
    res.json(result.data);
  });

  const clientDist = options.clientDist ?? path.resolve(__dirname, '../../client/dist');
  const indexHtml = path.join(clientDist, 'index.html');
  if (options.serveStatic !== false && fs.existsSync(indexHtml)) {
    app.use(
      express.static(clientDist, {
        index: false,
        maxAge: '1h',
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io') || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(indexHtml);
    });
  }

  io.on('connection', (socket) => {
    const allow = (): boolean => socketLimiter.allow(socket.id);

    socket.on('net:ping', (ack) => {
      if (typeof ack === 'function') ack({ ok: true, t: Date.now() });
    });

    socket.on('room:create', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.create(socket, payload ?? { name: '', maxPlayers: 0 }));
      } catch (error) {
        console.error('[room:create]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not create the room. Try again.' } });
      }
    });

    socket.on('room:join', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.join(socket, payload ?? { code: '', name: '' }));
      } catch (error) {
        console.error('[room:join]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not join the room. Try again.' } });
      }
    });

    socket.on('room:rejoin', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.rejoin(socket, payload ?? { code: '', secret: '' }));
      } catch (error) {
        console.error('[room:rejoin]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not reconnect. Try again.' } });
      }
    });

    socket.on('room:peek', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.peek(payload ?? { code: '' }));
      } catch {
        ack({ ok: false, error: { code: 'server-error', message: 'Could not load the room.' } });
      }
    });

    socket.on('room:leave', (ack) => {
      if (typeof ack !== 'function') return;
      try {
        ack(hub.leave(socket));
      } catch (error) {
        console.error('[room:leave]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not leave the room.' } });
      }
    });

    socket.on('room:ready', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.setReady(socket, Boolean(payload?.ready)));
      } catch {
        ack({ ok: false, error: { code: 'server-error', message: 'Could not update ready state.' } });
      }
    });

    socket.on('room:start', (ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.start(socket));
      } catch (error) {
        console.error('[room:start]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not start the game.' } });
      }
    });

    socket.on('room:rematch', (ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.rematch(socket));
      } catch (error) {
        console.error('[room:rematch]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not start a rematch.' } });
      }
    });

    socket.on('room:kick', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.kick(socket, String(payload?.playerId ?? '')));
      } catch (error) {
        console.error('[room:kick]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not remove that player.' } });
      }
    });

    socket.on('game:roll', (ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.roll(socket));
      } catch (error) {
        console.error('[game:roll]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not roll the dice.' } });
      }
    });

    socket.on('game:move', (payload, ack) => {
      if (typeof ack !== 'function') return;
      if (!allow()) return rateLimited(ack);
      try {
        ack(hub.move(socket, payload?.tokenId));
      } catch (error) {
        console.error('[game:move]', error);
        ack({ ok: false, error: { code: 'server-error', message: 'Could not move that token.' } });
      }
    });

    socket.on('disconnect', () => {
      socketLimiter.forget(socket.id);
      hub.disconnect(socket);
    });
  });

  const sweepTimer = setInterval(() => hub.sweep(), 45_000);
  sweepTimer.unref?.();

  const listen = (port = 0): Promise<number> =>
    new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(port, () => {
        const address = httpServer.address();
        resolve(typeof address === 'object' && address ? address.port : port);
      });
    });

  const close = (): Promise<void> =>
    new Promise((resolve) => {
      clearInterval(sweepTimer);
      io.close();
      httpServer.close(() => resolve());
      setTimeout(resolve, 500).unref();
    });

  return { app, httpServer, io, hub, listen, close };
}

function rateLimited<T>(ack: (res: T) => void): void {
  ack({ ok: false, error: { code: 'rate-limited', message: 'Too many actions. Please slow down.' } } as T);
}
