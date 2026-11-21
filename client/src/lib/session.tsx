import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getLegalMoves } from '@shared/engine.ts';
import type { ChatInput, ChatMessage } from '@shared/chat.ts';
import type { GameEvent, JoinResult, PeekInfo, PublicPlayer, RoomSnapshot } from '@shared/protocol.ts';
import type { Color, Move } from '@shared/types.ts';

import { COLOR_LABEL } from './format.ts';
import { useSettings } from './settings.tsx';
import { request, socket, waitForConnection } from './socket.ts';
import { clearSeat, loadSeat, rememberName, saveSeat, type SeatRecord } from './storage.ts';
import { useToast } from './toast.tsx';

export type SessionStatus = 'loading' | 'needs-name' | 'joined' | 'error';

export interface SessionError {
  code: string;
  message: string;
}

function playerName(snapshot: RoomSnapshot | null, color: Color): string {
  return snapshot?.players.find((p) => p.color === color)?.name ?? COLOR_LABEL[color];
}

export function useRoomSession(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const { push } = useToast();
  const { play } = useSettings();

  const pushRef = useRef(push);
  pushRef.current = push;
  const playRef = useRef(play);
  playRef.current = play;

  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [peek, setPeek] = useState<PeekInfo | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [error, setError] = useState<SessionError | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [connected, setConnected] = useState(socket.connected);
  const [busy, setBusy] = useState(false);

  const snapshotRef = useRef<RoomSnapshot | null>(null);
  const seatRef = useRef<SeatRecord | null>(null);
  const statusRef = useRef<SessionStatus>('loading');
  const bootedRef = useRef(false);
  const joinedOnceRef = useRef(false);
  const rejoiningRef = useRef(false);
  const mountedRef = useRef(true);

  const setStatusSafe = useCallback((next: SessionStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const applySnapshot = useCallback((next: RoomSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Boot: rejoin with a stored secret, otherwise peek at the room.
  useEffect(() => {
    let cancelled = false;
    bootedRef.current = false;
    joinedOnceRef.current = false;
    seatRef.current = loadSeat(code);
    snapshotRef.current = null;
    setSnapshot(null);
    setPeek(null);
    setError(null);
    setEvents([]);
    setChat([]);
    setMeId(null);
    setBusy(false);
    setStatusSafe('loading');

    const boot = async () => {
      const online = await waitForConnection();
      if (cancelled) return;
      if (!online) {
        setError({ code: 'offline', message: 'Cannot reach the game server. Check your connection and retry.' });
        setStatusSafe('error');
        bootedRef.current = true;
        return;
      }

      if (seatRef.current) {
        const response = await request<JoinResult>('room:rejoin', {
          code,
          secret: seatRef.current.secret,
        });
        if (cancelled) return;
        if (response.ok) {
          applySnapshot(response.data.snapshot);
          seatRef.current = { ...seatRef.current, playerId: response.data.playerId };
          setMeId(response.data.playerId);
          joinedOnceRef.current = true;
          setStatusSafe('joined');
          bootedRef.current = true;
          return;
        }
        if (response.error.code === 'room-not-found' || response.error.code === 'unknown-seat') {
          clearSeat(code);
          seatRef.current = null;
        } else {
          setError(response.error);
          setStatusSafe('error');
          bootedRef.current = true;
          return;
        }
      }

      const info = await request<PeekInfo>('room:peek', { code });
      if (cancelled) return;
      bootedRef.current = true;
      if (!info.ok) {
        setError(info.error);
        setStatusSafe('error');
        return;
      }
      if (!info.data.exists) {
        setError({ code: 'room-not-found', message: 'This room does not exist or has expired.' });
        setStatusSafe('error');
        return;
      }
      setPeek(info.data);
      if (info.data.phase === 'lobby' && info.data.takenSeats < info.data.maxPlayers) {
        setStatusSafe('needs-name');
      } else {
        setError({
          code: info.data.phase === 'lobby' ? 'room-full' : 'game-in-progress',
          message:
            info.data.phase === 'lobby'
              ? 'This room is full. Ask the host to free a seat or start a new room.'
              : 'A game is already in progress in this room.',
        });
        setStatusSafe('error');
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [code, applySnapshot, setStatusSafe]);

  // Live socket events.
  useEffect(() => {
    const onState = (next: RoomSnapshot) => {
      if (!mountedRef.current || next.code !== code) return;
      applySnapshot(next);
      if (statusRef.current !== 'joined' && (joinedOnceRef.current || seatRef.current)) {
        setStatusSafe('joined');
      }
    };

    const onEvent = (event: GameEvent) => {
      if (!mountedRef.current) return;
      const current = snapshotRef.current;
      if (!current) return;
      setEvents((previous) => [...previous.slice(-59), event]);

      switch (event.type) {
        case 'rolled':
          playRef.current('dice');
          break;
        case 'moved':
          if (event.captured.length > 0) playRef.current('capture');
          else if (event.finished) playRef.current('home');
          else playRef.current('step');
          if (event.auto) {
            pushRef.current(`${playerName(current, event.color)} was auto-played (disconnected).`, 'warn');
          }
          break;
        case 'passed':
          // A skipped turn is routine; keep the board quiet instead of toasting it.
          break;
        case 'forfeit':
          playRef.current('error');
          pushRef.current(`${playerName(current, event.color)} rolled three sixes and lost the turn.`, 'warn');
          break;
        case 'game-over':
          playRef.current('win');
          break;
        case 'started':
          playRef.current('start');
          break;
        case 'rematch':
          playRef.current('start');
          break;
        case 'system':
          pushRef.current(event.message, event.tone === 'warn' ? 'warn' : 'info');
          break;
        case 'kicked':
          break;
      }
    };

    const onChat = (message: ChatMessage) => {
      if (!mountedRef.current) return;
      setChat((previous) => [...previous.slice(-59), message]);
      playRef.current('click');
    };

    const onClosed = (payload: { reason: string }) => {
      if (!mountedRef.current) return;
      clearSeat(code);
      seatRef.current = null;
      joinedOnceRef.current = false;
      snapshotRef.current = null;
      setSnapshot(null);
      setError({ code: 'room-closed', message: payload.reason });
      setStatusSafe('error');
      playRef.current('leave');
    };

    const onReplaced = () => {
      if (!mountedRef.current) return;
      setError({
        code: 'session-replaced',
        message: 'This seat was opened in another tab or device. Use that tab to keep playing.',
      });
      setStatusSafe('error');
    };

    const onNotice = (notice: { tone: 'info' | 'warn' | 'error'; message: string }) => {
      pushRef.current(notice.message, notice.tone);
    };

    const onConnect = () => {
      setConnected(true);
      if (!bootedRef.current) return;
      const seat = seatRef.current;
      if (!seat || !joinedOnceRef.current) return;
      if (rejoiningRef.current) return;
      rejoiningRef.current = true;
      void (async () => {
        try {
          const response = await request<JoinResult>('room:rejoin', { code, secret: seat.secret }, 9000);
          if (!mountedRef.current) return;
          if (response.ok) {
            applySnapshot(response.data.snapshot);
            setMeId(response.data.playerId);
            setStatusSafe('joined');
          } else if (response.error.code === 'unknown-seat' || response.error.code === 'room-not-found') {
            clearSeat(code);
            seatRef.current = null;
            setError({ code: response.error.code, message: response.error.message });
            setStatusSafe('error');
          }
        } finally {
          rejoiningRef.current = false;
        }
      })();
    };

    const onDisconnect = () => setConnected(false);

    socket.on('room:state', onState);
    socket.on('game:event', onEvent);
    socket.on('chat:message', onChat);
    socket.on('room:closed', onClosed);
    socket.on('session:replaced', onReplaced);
    socket.on('notice', onNotice);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('room:state', onState);
      socket.off('game:event', onEvent);
      socket.off('chat:message', onChat);
      socket.off('room:closed', onClosed);
      socket.off('session:replaced', onReplaced);
      socket.off('notice', onNotice);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [code, applySnapshot, setStatusSafe]);

  // Refresh the lobby preview while the visitor is choosing a name.
  useEffect(() => {
    if (status !== 'needs-name') return;
    let cancelled = false;
    const tick = async () => {
      const info = await request<PeekInfo>('room:peek', { code }, 6000);
      if (cancelled || !info.ok) return;
      setPeek(info.data);
      if (!info.data.exists) {
        setError({ code: 'room-not-found', message: 'This room is no longer available.' });
        setStatusSafe('error');
      } else if (info.data.phase !== 'lobby' || info.data.takenSeats >= info.data.maxPlayers) {
        setError({
          code: info.data.phase === 'lobby' ? 'room-full' : 'game-in-progress',
          message:
            info.data.phase === 'lobby'
              ? 'This room just filled up.'
              : 'A game just started in this room without you.',
        });
        setStatusSafe('error');
      }
    };
    const interval = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [status, code, setStatusSafe]);

  const me: PublicPlayer | null = useMemo(
    () => snapshot?.players.find((player) => player.id === meId) ?? null,
    [snapshot, meId],
  );

  const isHost = Boolean(me && snapshot && snapshot.hostId === me.id);
  const isMyTurn = Boolean(
    me && snapshot?.game && snapshot.phase === 'playing' && snapshot.game.turnColor === me.color,
  );

  const legalMoves: Move[] = useMemo(() => {
    if (!snapshot?.game || !me || snapshot.phase !== 'playing') return [];
    if (snapshot.game.turnColor !== me.color || snapshot.game.dice === null) return [];
    return getLegalMoves(snapshot.game);
  }, [snapshot, me]);

  const refreshPeek = useCallback(async () => {
    const info = await request<PeekInfo>('room:peek', { code });
    if (info.ok) setPeek(info.data);
  }, [code]);

  const join = useCallback(
    async (name: string): Promise<boolean> => {
      setBusy(true);
      const response = await request<JoinResult>('room:join', { code, name });
      setBusy(false);
      if (!response.ok) {
        pushRef.current(response.error.message, 'error');
        playRef.current('error');
        return false;
      }
      saveSeat(code, { playerId: response.data.playerId, secret: response.data.secret, name: name.trim() });
      seatRef.current = { playerId: response.data.playerId, secret: response.data.secret, name: name.trim() };
      rememberName(name.trim());
      applySnapshot(response.data.snapshot);
      setMeId(response.data.playerId);
      joinedOnceRef.current = true;
      setStatusSafe('joined');
      playRef.current('start');
      return true;
    },
    [code, applySnapshot, setStatusSafe],
  );

  const act = useCallback(
    async <T,>(event: string, payload?: unknown): Promise<boolean> => {
      const response = await request<T>(event, payload);
      if (!response.ok) {
        pushRef.current(response.error.message, 'error');
        playRef.current('error');
        return false;
      }
      return true;
    },
    [],
  );

  const roll = useCallback(async () => {
    await act('game:roll');
  }, [act]);

  const move = useCallback(
    async (tokenId: number) => {
      await act('game:move', { tokenId });
    },
    [act],
  );

  const setReady = useCallback(
    async (ready: boolean) => {
      await act('room:ready', { ready });
    },
    [act],
  );

  const start = useCallback(async () => {
    await act('room:start');
  }, [act]);

  const rematch = useCallback(async () => {
    await act('room:rematch');
  }, [act]);

  const kick = useCallback(
    async (playerId: string) => {
      await act('room:kick', { playerId });
    },
    [act],
  );

  const sendChat = useCallback(
    async (input: ChatInput) => {
      await act('chat:send', input);
    },
    [act],
  );

  const leave = useCallback(async () => {
    await request('room:leave', undefined, 4000);
    clearSeat(code);
    seatRef.current = null;
    joinedOnceRef.current = false;
    setSnapshot(null);
    setMeId(null);
    setStatusSafe('needs-name');
  }, [code, setStatusSafe]);

  return {
    code,
    status,
    error,
    snapshot,
    peek,
    me,
    isHost,
    isMyTurn,
    legalMoves,
    events,
    chat,
    connected,
    busy,
    join,
    roll,
    move,
    setReady,
    start,
    rematch,
    kick,
    sendChat,
    leave,
    refreshPeek,
    retry: () => window.location.reload(),
  };
}

export type RoomSession = ReturnType<typeof useRoomSession>;
