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
  /** Insert or replace a stroke, keeping the list ordered by seq. */
  upsertStroke: (stroke: Stroke) => void;
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
  upsertStroke: (stroke) => set((s) => {
    const next = s.strokes.filter(st => st.id !== stroke.id);
    // Almost always an append, so scan from the end for the insertion point.
    let i = next.length;
    while (i > 0 && next[i - 1].seq > stroke.seq) i--;
    next.splice(i, 0, stroke);
    return { strokes: next };
  }),
  setStrokes: (strokes) => set({ strokes: [...strokes].sort((a, b) => a.seq - b.seq) }),
  removeStroke: (strokeId) => set((s) => ({ strokes: s.strokes.filter(st => st.id !== strokeId) })),
  setError: (error) => set({ error }),
}));
