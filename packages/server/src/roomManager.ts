import {
  Player, RoomState, GameState, GameSaveFile, Stroke,
  generateRoomCode, generateId, buildSaveFile, PLAYER_COLORS, MAX_PLAYERS,
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

/**
 * How long an empty room is kept alive. A table that all steps away - a
 * refresh, a dropped connection, a break between sessions - should still be
 * there to walk back into, so the room outlives the last socket for a while.
 */
const EMPTY_ROOM_GRACE_MS = 60 * 60 * 1000;
const emptyRoomTimers = new Map<string, NodeJS.Timeout>();

function scheduleCleanup(roomId: string): void {
  cancelCleanup(roomId);
  const timer = setTimeout(() => {
    emptyRoomTimers.delete(roomId);
    const room = rooms.get(roomId);
    if (room && room.state.players.every(p => !p.connected)) rooms.delete(roomId);
  }, EMPTY_ROOM_GRACE_MS);
  // Never hold the process open just to reap a room.
  timer.unref?.();
  emptyRoomTimers.set(roomId, timer);
}

function cancelCleanup(roomId: string): void {
  const timer = emptyRoomTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    emptyRoomTimers.delete(roomId);
  }
}

function freshRoomId(): string {
  let roomId: string;
  do {
    roomId = generateRoomCode();
  } while (rooms.has(roomId));
  return roomId;
}

/**
 * Mirror the room roster into the running game, which owns contempt tokens
 * and nothing else about a player. One roster, two broadcasts that agree.
 */
function syncGamePlayers(room: Room): void {
  if (!room.game) return;
  const contempt = new Map(room.game.players.map(p => [p.id, p.contemptTokens]));
  room.game = {
    ...room.game,
    players: room.state.players.map(p => ({ ...p, contemptTokens: contempt.get(p.id) ?? 0 })),
  };
}

/** A colour no one at the table is already using, where one is left. */
function nextColor(players: Player[]): string {
  const taken = new Set(players.map(p => p.color));
  return PLAYER_COLORS.find(c => !taken.has(c)) ?? PLAYER_COLORS[players.length % PLAYER_COLORS.length];
}

function makePlayer(name: string, players: Player[], isHost: boolean): Player {
  return {
    id: generateId(),
    name,
    contemptTokens: 0,
    isHost,
    connected: true,
    color: nextColor(players),
    canDraw: true,
  };
}

export function createRoom(playerName: string, socketId: string): { room: Room; playerId: string } {
  const roomId = freshRoomId();
  const player = makePlayer(playerName, [], true);

  const room: Room = {
    state: {
      roomId,
      players: [player],
      hostId: player.id,
      gameStarted: false,
      allowMidGameJoin: false,
    },
    game: null,
    strokes: [],
    redoStacks: new Map(),
    nextSeq: 1,
    playerSockets: new Map([[player.id, socketId]]),
  };

  rooms.set(roomId, room);
  return { room, playerId: player.id };
}

/**
 * Open a room around a saved game. Everyone who was at the table keeps their
 * seat, their colour and their contempt, but comes back marked away until
 * they rejoin by name. Whoever loads the file takes their own seat back if
 * their name is on it, and hosts either way.
 */
export function createRoomFromSave(
  playerName: string, socketId: string, save: GameSaveFile,
): { room: Room; playerId: string } | { error: string } {
  const game: GameState = { ...save.game };

  // The save's players are already normalized to away-and-not-host.
  const players: Player[] = game.players.map(p => ({ ...p }));
  let self = players.find(p => sameName(p.name, playerName));
  if (!self) {
    if (players.length >= MAX_PLAYERS) {
      return {
        error: `That game already seats ${players.length} players. Load it under the name you played as: ${players.map(p => p.name).join(', ')}.`,
      };
    }
    self = makePlayer(playerName, players, true);
    players.push(self);
    game.turnOrder = [...game.turnOrder, self.id];
  }
  self.connected = true;
  self.isHost = true;
  self.canDraw = true;

  const roomId = freshRoomId();
  game.roomId = roomId;

  const room: Room = {
    state: {
      roomId,
      players,
      hostId: self.id,
      gameStarted: true,
      allowMidGameJoin: false,
    },
    game,
    strokes: [],
    redoStacks: new Map(),
    nextSeq: 1,
    playerSockets: new Map([[self.id, socketId]]),
  };

  room.strokes = replaceStrokes(room, save.strokes);
  syncGamePlayers(room);
  rooms.set(roomId, room);
  return { room, playerId: self.id };
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Take a seat in an existing room. Someone whose name is already at the table
 * and away is picking their own seat back up - the usual case after a refresh
 * or a dropped connection, and the way a loaded save is repopulated. Everyone
 * else is a newcomer, which a game already under way only allows if the host
 * has opened the door.
 */
export function joinRoom(
  roomId: string, playerName: string, socketId: string,
): { room: Room; playerId: string; rejoined: boolean } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: 'Room not found' };

  const name = playerName.trim();
  const sameNamed = room.state.players.find(p => sameName(p.name, name));
  if (sameNamed) {
    if (sameNamed.connected) {
      return { error: 'Someone with that name is already in this room' };
    }
    cancelCleanup(roomId);
    sameNamed.connected = true;
    room.playerSockets.set(sameNamed.id, socketId);
    syncGamePlayers(room);
    return { room, playerId: sameNamed.id, rejoined: true };
  }

  if (room.state.gameStarted && !room.state.allowMidGameJoin) {
    return { error: 'Game already in progress' };
  }
  if (room.state.players.length >= MAX_PLAYERS) return { error: 'Room is full' };

  cancelCleanup(roomId);
  const player = makePlayer(name, room.state.players, false);
  room.state.players.push(player);
  room.playerSockets.set(player.id, socketId);

  // A newcomer to a game in progress joins the end of the order; the host can
  // move them if they belong somewhere else in the round.
  if (room.game) {
    room.game = { ...room.game, turnOrder: [...room.game.turnOrder, player.id] };
    syncGamePlayers(room);
  }

  return { room, playerId: player.id, rejoined: false };
}

/** Everything the table has made so far, ready to be written to a file. */
export function exportRoom(room: Room): GameSaveFile | null {
  if (!room.game) return null;
  return buildSaveFile(room.game, room.strokes, room.state.roomId);
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

/** Open or close the door on newcomers once the year is under way. */
export function setAllowMidGameJoin(room: Room, allow: boolean): void {
  room.state.allowMidGameJoin = allow;
}

/**
 * Put the table in a given order. `order` must name exactly the players who
 * are in the room; whoever is mid-turn stays mid-turn, wherever they land.
 */
export function reorderPlayers(room: Room, order: string[]): boolean {
  const current = room.state.players;
  if (order.length !== current.length) return false;
  const byId = new Map(current.map(p => [p.id, p]));
  const seen = new Set<string>();
  const reordered: Player[] = [];
  for (const id of order) {
    const player = byId.get(id);
    if (!player || seen.has(id)) return false;
    seen.add(id);
    reordered.push(player);
  }

  room.state.players = reordered;
  if (room.game) {
    const activeId = room.game.turnOrder[room.game.activePlayerIndex];
    const turnOrder = order.filter(id => room.game!.turnOrder.includes(id));
    const activePlayerIndex = Math.max(0, turnOrder.indexOf(activeId));
    room.game = { ...room.game, turnOrder, activePlayerIndex };
    syncGamePlayers(room);
  }
  return true;
}

/**
 * Remove a player outright. If it was their turn, the week passes to whoever
 * now holds their slot, starting fresh - there is no half-played turn to
 * inherit - and anything the table was waiting on them for is let go.
 */
export function kickPlayer(room: Room, playerId: string): { socketId?: string } | null {
  const player = room.state.players.find(p => p.id === playerId);
  if (!player) return null;
  if (room.state.hostId === playerId) return null;

  const socketId = room.playerSockets.get(playerId);
  room.state.players = room.state.players.filter(p => p.id !== playerId);
  room.playerSockets.delete(playerId);
  room.redoStacks.delete(playerId);

  if (room.game) {
    room.game = removeFromGame(room.game, playerId);
    syncGamePlayers(room);
  }
  return { socketId };
}

function removeFromGame(game: GameState, playerId: string): GameState {
  const seat = game.turnOrder.indexOf(playerId);
  const turnOrder = game.turnOrder.filter(id => id !== playerId);
  const wasActive = seat === game.activePlayerIndex;

  let activePlayerIndex = game.activePlayerIndex;
  if (seat !== -1 && seat < game.activePlayerIndex) activePlayerIndex--;
  if (turnOrder.length === 0) activePlayerIndex = 0;
  else activePlayerIndex = ((activePlayerIndex % turnOrder.length) + turnOrder.length) % turnOrder.length;

  let next: GameState = {
    ...game,
    players: game.players.filter(p => p.id !== playerId),
    turnOrder,
    activePlayerIndex,
  };

  // Whatever they still owed the table, the table stops waiting for.
  if (next.discussion) {
    const expectedResponders = next.discussion.expectedResponders.filter(id => id !== playerId);
    next = { ...next, discussion: { ...next.discussion, expectedResponders } };
    if (expectedResponders.length === 0 && next.phase === 'discussion') {
      next = { ...next, phase: 'playing', turnPhase: 'turn-complete' };
    }
  }

  if (wasActive && next.phase !== 'game-over') {
    next = {
      ...next,
      phase: next.phase === 'discussion' ? 'playing' : next.phase,
      discussion: next.phase === 'discussion' ? null : next.discussion,
      turnPhase: next.pendingResolutions.length > 0 ? 'resolve-project' : 'draw-card',
      currentCard: null,
      chosenPrompt: null,
    };
  }

  return next;
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

  // An empty room is kept for a while so the table can walk back into it,
  // by rejoining with the same names, rather than losing the year.
  if (room.state.players.every(p => !p.connected)) {
    scheduleCleanup(room.state.roomId);
  }

  if (room.game) syncGamePlayers(room);
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
