import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientEvents, ServerEvents } from '@quiet-year/shared';
import { useGameStore } from '../store/gameStore';

const SERVER_URL = 'http://localhost:3001';

type TypedSocket = Socket<ServerEvents, ClientEvents>;

let globalSocket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
    }) as TypedSocket;
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<TypedSocket>(getSocket());
  const {
    setPlayerId, setRoomId, setConnected,
    setRoomState, setGameState,
    addStroke, setStrokes, removeStroke,
    setError,
  } = useGameStore();

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room:created', ({ roomId, playerId }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
    });

    socket.on('room:joined', ({ playerId }) => {
      setPlayerId(playerId);
    });

    socket.on('room:state', (state) => {
      setRoomState(state);
    });

    socket.on('room:error', ({ message }) => {
      setError(message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('game:state', (state) => {
      setGameState(state);
    });

    socket.on('draw:stroke', (stroke) => {
      addStroke(stroke);
    });

    socket.on('draw:history', (strokes) => {
      setStrokes(strokes);
    });

    socket.on('draw:undo', ({ strokeId }) => {
      removeStroke(strokeId);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:state');
      socket.off('room:error');
      socket.off('game:state');
      socket.off('draw:stroke');
      socket.off('draw:history');
      socket.off('draw:undo');
    };
  }, []);

  return socketRef.current;
}
