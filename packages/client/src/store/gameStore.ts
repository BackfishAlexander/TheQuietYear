import { create } from 'zustand';
import type { GameState, RoomState, Stroke } from '@quiet-year/shared';

interface GameStore {
  // Connection
  playerId: string | null;
  roomId: string | null;
  playerName: string;
  connected: boolean;

  // Room state (pre-game)
  roomState: RoomState | null;

  // Game state
  gameState: GameState | null;

  // Drawing
  strokes: Stroke[];

  // Error
  error: string | null;

  // Actions
  setPlayerId: (id: string) => void;
  setRoomId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setConnected: (connected: boolean) => void;
  setRoomState: (state: RoomState) => void;
  setGameState: (state: GameState) => void;
  addStroke: (stroke: Stroke) => void;
  setStrokes: (strokes: Stroke[]) => void;
  removeStroke: (strokeId: string) => void;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  playerId: null,
  roomId: null,
  playerName: '',
  connected: false,
  roomState: null,
  gameState: null,
  strokes: [],
  error: null,

  setPlayerId: (id) => set({ playerId: id }),
  setRoomId: (id) => set({ roomId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setConnected: (connected) => set({ connected }),
  setRoomState: (state) => set({ roomState: state }),
  setGameState: (state) => set({ gameState: state }),
  addStroke: (stroke) => set((s) => ({ strokes: [...s.strokes, stroke] })),
  setStrokes: (strokes) => set({ strokes }),
  removeStroke: (strokeId) => set((s) => ({ strokes: s.strokes.filter(st => st.id !== strokeId) })),
  setError: (error) => set({ error }),
}));
