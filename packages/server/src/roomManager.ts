import {
  Player, RoomState, GameState, Stroke,
  generateRoomCode, generateId, PLAYER_COLORS,
} from '@quiet-year/shared';

interface Room {
  state: RoomState;
  game: GameState | null;
  strokes: Stroke[];
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
  };

  room.state.players.push(player);
  room.playerSockets.set(playerId, socketId);
  return { room, playerId };
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
