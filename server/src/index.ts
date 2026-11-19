import { createLudoServer, DEFAULT_HUB_CONFIG } from './app.ts';
import { envInt } from './util.ts';

const PORT = envInt('PORT', 4000);
const corsOrigins = (process.env.CLIENT_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const ludo = createLudoServer({
  corsOrigins,
  config: {
    autoPlayDelayMs: envInt('TURN_AUTOPLAY_MS', DEFAULT_HUB_CONFIG.autoPlayDelayMs),
    autoMoveDelayMs: envInt('AUTO_MOVE_MS', DEFAULT_HUB_CONFIG.autoMoveDelayMs),
    passDelayMs: envInt('PASS_DELAY_MS', DEFAULT_HUB_CONFIG.passDelayMs),
    lobbyTtlMs: envInt('LOBBY_TTL_MS', DEFAULT_HUB_CONFIG.lobbyTtlMs),
    gameTtlMs: envInt('GAME_TTL_MS', DEFAULT_HUB_CONFIG.gameTtlMs),
    hostTransferMs: envInt('HOST_TRANSFER_MS', DEFAULT_HUB_CONFIG.hostTransferMs),
    lobbySeatTtlMs: envInt('LOBBY_SEAT_TTL_MS', DEFAULT_HUB_CONFIG.lobbySeatTtlMs),
    maxRoomAgeMs: envInt('MAX_ROOM_AGE_MS', DEFAULT_HUB_CONFIG.maxRoomAgeMs),
    createPerMinute: envInt('CREATE_PER_MINUTE', DEFAULT_HUB_CONFIG.createPerMinute),
    joinPerMinute: envInt('JOIN_PER_MINUTE', DEFAULT_HUB_CONFIG.joinPerMinute),
  },
});

ludo.listen(PORT).then((port) => {
  console.log(`[ludo] server listening on http://localhost:${port}`);
  console.log('[ludo] zero-cost stack: Node + Express + Socket.IO + React (no database)');
});

let closing = false;
function shutdown(signal: string): void {
  if (closing) return;
  closing = true;
  console.log(`[ludo] ${signal} received, shutting down...`);
  ludo.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 4000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
