import {
  Player, RoomState, GameState, Stroke,
  generateRoomCode, generateId, PLAYER_COLORS,
} from '@quiet-year/shared';

export interface Room {
  state: RoomState;
  game: GameState | null;
  /** Visible strokes, always kept sorted by seq. */
  strokes: Stroke[];
  /** Per-player stack of strokes removed by undo, newest last. */
  redoStacks: Map<string, Stroke[]>;
  /** Monotonic z-order counter; never reused, so redo restores in place. */
  nextSeq: number;
  playerSockets: Map<string, string>; // playerId -> socketId
}

const rooms = new Map<string, Room>();

export function createRoom(playerName: string, socketId: string): { room: Room; playerId: string } {
  let roomId: string;
  do {
    roomId = generateRoomCode();
  } while (rooms.has(roomId));

  const playerId = generateId();
  const player: Player = {
    id: playerId,
    name: playerName,
    contemptTokens: 0,
    isHost: true,
    connected: true,
    color: PLAYER_COLORS[0],
    canDraw: true,
  };

  const room: Room = {
    state: {
      roomId,
      players: [player],
      hostId: playerId,
      gameStarted: false,
    },
    game: null,
    strokes: [],
    redoStacks: new Map(),
    nextSeq: 1,
    playerSockets: new Map([[playerId, socketId]]),
  };

  rooms.set(roomId, room);
  return { room, playerId };
}

export function joinRoom(roomId: string, playerName: string, socketId: string): { room: Room; playerId: string } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };
  if (room.state.gameStarted) return { error: 'Game already in progress' };
  if (room.state.players.length >= 4) return { error: 'Room is full' };

  const playerId = generateId();
  const player: Player = {
    id: playerId,
    name: playerName,
    contemptTokens: 0,
    isHost: false,
    connected: true,
    color: PLAYER_COLORS[room.state.players.length],
    canDraw: true,
  };

  room.state.players.push(player);
  room.playerSockets.set(playerId, socketId);
  return { room, playerId };
}

/** Add a stroke to the room, stamping it with the next z-order slot. */
export function appendStroke(room: Room, stroke: Stroke): Stroke {
  const placed: Stroke = { ...stroke, seq: room.nextSeq++ };
  room.strokes.push(placed);
  // A fresh mark makes the player's redo history unreachable, as in any editor.
  room.redoStacks.delete(placed.playerId);
  return placed;
}

/** Remove the player's most recent stroke and push it onto their redo stack. */
export function undoStroke(room: Room, playerId: string): Stroke | undefined {
  for (let i = room.strokes.length - 1; i >= 0; i--) {
    if (room.strokes[i].playerId === playerId) {
      const [removed] = room.strokes.splice(i, 1);
      const stack = room.redoStacks.get(playerId) ?? [];
      stack.push(removed);
      room.redoStacks.set(playerId, stack);
      return removed;
    }
  }
  return undefined;
}

/** Put the player's most recently undone stroke back at its original depth. */
export function redoStroke(room: Room, playerId: string): Stroke | undefined {
  const stack = room.redoStacks.get(playerId);
  const stroke = stack?.pop();
  if (!stroke) return undefined;
  if (stack!.length === 0) room.redoStacks.delete(playerId);

  const at = room.strokes.findIndex(s => s.seq > stroke.seq);
  if (at === -1) room.strokes.push(stroke);
  else room.strokes.splice(at, 0, stroke);
  return stroke;
}

/** Wipe the canvas, including everyone's redo history. */
export function clearStrokes(room: Room): void {
  room.strokes = [];
  room.redoStacks.clear();
}

/** Replace the canvas with a loaded file's strokes, re-stamping their order. */
export function replaceStrokes(room: Room, strokes: Stroke[]): Stroke[] {
  room.redoStacks.clear();
  room.strokes = strokes.map(s => ({ ...s, seq: room.nextSeq++ }));
  return room.strokes;
}

/**
 * Set a player's draw permission on the room roster, mirroring it into the
 * in-progress game state so both broadcasts agree.
 */
export function setDrawPermission(room: Room, playerId: string, canDraw: boolean): boolean {
  const player = room.state.players.find(p => p.id === playerId);
  if (!player) return false;
  player.canDraw = canDraw;
  if (room.game) {
    room.game = {
      ...room.game,
      players: room.game.players.map(p => (p.id === playerId ? { ...p, canDraw } : p)),
    };
  }
  return true;
}

export function canPlayerDraw(room: Room, playerId: string): boolean {
  const player = room.state.players.find(p => p.id === playerId);
  return player ? player.canDraw : false;
}

export function isHost(room: Room, playerId: string): boolean {
  return room.state.hostId === playerId;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getRoomBySocket(socketId: string): { room: Room; playerId: string } | undefined {
  for (const room of rooms.values()) {
    for (const [playerId, sid] of room.playerSockets) {
      if (sid === socketId) {
        return { room, playerId };
      }
    }
  }
  return undefined;
}

export function disconnectPlayer(socketId: string): { room: Room; playerId: string } | undefined {
  const result = getRoomBySocket(socketId);
  if (!result) return undefined;

  const { room, playerId } = result;
  const player = room.state.players.find(p => p.id === playerId);
  if (player) {
    player.connected = false;
  }

  // Clean up empty rooms
  const allDisconnected = room.state.players.every(p => !p.connected);
  if (allDisconnected) {
    rooms.delete(room.state.roomId);
    return undefined;
  }

  return result;
}

export function reconnectPlayer(roomId: string, playerId: string, socketId: string): Room | undefined {
  const room = rooms.get(roomId);
  if (!room) return undefined;

  const player = room.state.players.find(p => p.id === playerId);
  if (!player) return undefined;

  player.connected = true;
  room.playerSockets.set(playerId, socketId);
  return room;
}
