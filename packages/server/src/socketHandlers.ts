import { Server, Socket } from 'socket.io';
import {
  ClientEvents, ServerEvents, GameState, ResourceKind,
  normalizeStroke, normalizeStrokes, normalizeSaveFile,
} from '@quiet-year/shared';
import * as roomManager from './roomManager.js';
import * as gameManager from './gameManager.js';

type TypedSocket = Socket<ClientEvents, ServerEvents>;

function broadcastRoomState(io: Server, roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (room) {
    io.to(roomId).emit('room:state', room.state);
  }
}

function broadcastGameState(io: Server, roomId: string) {
  const room = roomManager.getRoom(roomId);
  if (room?.game) {
    // Send game state without the deck contents (clients only need count)
    const clientState: GameState = {
      ...room.game,
      deck: room.game.deck.map(() => ({
        id: 'hidden',
        suit: 'hearts',
        rank: 'ace',
        season: 'spring',
        promptA: '',
        promptB: null,
        specialRules: null,
      })),
    };
    io.to(roomId).emit('game:state', clientState);
  }
}

function applyGameUpdate(io: Server, roomId: string, result: GameState | { error: string }, socket: TypedSocket) {
  if ('error' in result) {
    socket.emit('room:error', { message: result.error });
    return;
  }
  const room = roomManager.getRoom(roomId);
  if (room) {
    room.game = result;
    broadcastGameState(io, roomId);
  }
}

/** The socket's room, but only if the host currently lets this player draw. */
function drawingRoom(socket: TypedSocket): roomManager.Room | undefined {
  const { roomId, playerId } = (socket.data ?? {}) as { roomId?: string; playerId?: string };
  if (!roomId || !playerId) return undefined;
  const room = roomManager.getRoom(roomId);
  if (!room) return undefined;
  if (!roomManager.canPlayerDraw(room, playerId)) {
    socket.emit('room:error', { message: 'Drawing is disabled for you by the host' });
    return undefined;
  }
  return room;
}

/** The socket's room, but only if this socket belongs to the host. */
function adminRoom(socket: TypedSocket): roomManager.Room | undefined {
  const { roomId, playerId } = (socket.data ?? {}) as { roomId?: string; playerId?: string };
  if (!roomId || !playerId) return undefined;
  const room = roomManager.getRoom(roomId);
  if (!room) return undefined;
  if (!roomManager.isHost(room, playerId)) {
    socket.emit('room:error', { message: 'Only the host can do that' });
    return undefined;
  }
  return room;
}

/** Everything a socket needs on arrival: the roster, the game, the map. */
function sendRoomSnapshot(io: Server, socket: TypedSocket, room: roomManager.Room) {
  broadcastRoomState(io, room.state.roomId);
  if (room.game) broadcastGameState(io, room.state.roomId);
  socket.emit('draw:history', room.strokes);
}

function changeResource(
  io: Server, socket: TypedSocket,
  kind: ResourceKind, op: 'add' | 'remove', value: string,
) {
  const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
  const room = roomManager.getRoom(roomId);
  if (!room?.game) return;
  room.game = gameManager.handleResourceChange(room.game, playerId, kind, op, value);
  broadcastGameState(io, roomId);
}

export function registerHandlers(io: Server, socket: TypedSocket) {
  // Room management
  socket.on('room:create', ({ playerName }) => {
    const { room, playerId } = roomManager.createRoom(playerName, socket.id);
    socket.join(room.state.roomId);
    socket.data = { roomId: room.state.roomId, playerId };
    socket.emit('room:created', { roomId: room.state.roomId, playerId });
    broadcastRoomState(io, room.state.roomId);
  });

  socket.on('room:join', ({ roomId, playerName }) => {
    const code = roomId.toUpperCase();
    const result = roomManager.joinRoom(code, playerName, socket.id);
    if ('error' in result) {
      socket.emit('room:error', { message: result.error });
      return;
    }
    const { room, playerId } = result;
    socket.join(code);
    socket.data = { roomId: code, playerId };
    socket.emit('room:joined', { playerId });
    sendRoomSnapshot(io, socket, room);
  });

  // Pick a year back up from a file: the uploader opens a fresh room around
  // the saved state and hosts it, and everyone else rejoins by their name.
  socket.on('room:createFromSave', ({ playerName, save }) => {
    const name = (playerName ?? '').trim();
    if (!name) {
      socket.emit('room:error', { message: 'Enter your name before loading a game' });
      return;
    }
    const parsed = normalizeSaveFile(save);
    if ('error' in parsed) {
      socket.emit('room:error', { message: parsed.error });
      return;
    }
    const opened = roomManager.createRoomFromSave(name, socket.id, parsed.save);
    if ('error' in opened) {
      socket.emit('room:error', { message: opened.error });
      return;
    }
    const { room, playerId } = opened;
    socket.join(room.state.roomId);
    socket.data = { roomId: room.state.roomId, playerId };
    socket.emit('room:created', { roomId: room.state.roomId, playerId });
    sendRoomSnapshot(io, socket, room);
  });

  // A save of everything so far. The undrawn deck is in it, so only the host
  // may take one while the year is still running; once the Frost Shepherds
  // have arrived there is nothing left to spoil and anyone can keep a copy.
  socket.on('game:export', () => {
    const { roomId, playerId } = (socket.data ?? {}) as { roomId?: string; playerId?: string };
    const room = roomId ? roomManager.getRoom(roomId) : undefined;
    if (!room?.game || !playerId) {
      socket.emit('room:error', { message: 'There is no game to save yet' });
      return;
    }
    if (!roomManager.isHost(room, playerId) && room.game.phase !== 'game-over') {
      socket.emit('room:error', { message: 'Only the host can save the game while it is running' });
      return;
    }
    const save = roomManager.exportRoom(room);
    if (save) socket.emit('game:save', save);
  });

  // Game start
  socket.on('game:start', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (room.state.hostId !== playerId) {
      socket.emit('room:error', { message: 'Only the host can start the game' });
      return;
    }
    if (room.state.players.length < 2) {
      socket.emit('room:error', { message: 'Need at least 2 players' });
      return;
    }

    room.state.gameStarted = true;
    room.game = gameManager.createInitialGameState(roomId, room.state.players);
    broadcastRoomState(io, roomId);
    broadcastGameState(io, roomId);
  });

  // Setup
  socket.on('setup:finishTerrain', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    if (room.state.hostId !== playerId) return;
    room.game = gameManager.finishTerrain(room.game);
    broadcastGameState(io, roomId);
  });

  socket.on('setup:declareResource', ({ resource }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.declareResource(room.game, playerId, resource);
    broadcastGameState(io, roomId);
  });

  socket.on('setup:voteAbundance', ({ resource }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.voteAbundance(room.game, playerId, resource);
    broadcastGameState(io, roomId);
  });

  // Turn actions
  socket.on('turn:drawCard', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleDrawCard(room.game, playerId), socket);
  });

  socket.on('turn:choosePrompt', ({ choice }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleChoosePrompt(room.game, playerId, choice), socket);
  });

  socket.on('turn:narrate', ({ text }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleNarrate(room.game, playerId, text), socket);
  });

  socket.on('turn:action', ({ action }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleAction(room.game, playerId, action), socket);
  });

  socket.on('turn:discover', ({ description }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleDiscover(room.game, playerId, description), socket);
  });

  socket.on('turn:startDiscussion', ({ topic }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleStartDiscussion(room.game, playerId, topic), socket);
  });

  socket.on('discussion:respond', ({ text }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleDiscussionResponse(room.game, playerId, text), socket);
  });

  socket.on('turn:startProject', ({ name, description, duration, position }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleStartProject(room.game, playerId, name, description, duration, position), socket);
  });

  socket.on('turn:resolveProject', ({ projectId, resolution }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleResolveProject(room.game, playerId, projectId, resolution), socket);
  });

  socket.on('discussion:skipResponder', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    if (!roomManager.isHost(room, playerId)) {
      socket.emit('room:error', { message: 'Only the host can skip a responder' });
      return;
    }
    applyGameUpdate(io, roomId, gameManager.handleSkipResponder(room.game), socket);
  });

  // Projects are freely editable: cards hand out dice, take them away, and
  // sometimes destroy a project outright.
  socket.on('project:setDice', ({ projectId, weeksRemaining }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleProjectSetDice(room.game, playerId, projectId, weeksRemaining), socket);
  });

  socket.on('project:setStatus', ({ projectId, status }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleProjectSetStatus(room.game, playerId, projectId, status), socket);
  });

  socket.on('project:remove', ({ projectId }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleProjectRemove(room.game, playerId, projectId), socket);
  });

  socket.on('turn:endTurn', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    applyGameUpdate(io, roomId, gameManager.handleEndTurn(room.game, playerId), socket);
  });

  // Contempt
  socket.on('contempt:take', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleContempt(room.game, playerId, 'take');
    broadcastGameState(io, roomId);
  });

  socket.on('contempt:discard', ({ reason }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleContempt(room.game, playerId, 'discard', reason);
    broadcastGameState(io, roomId);
  });

  // Resources
  socket.on('resource:addAbundance', ({ resource }) => {
    changeResource(io, socket, 'abundance', 'add', resource);
  });

  socket.on('resource:addScarcity', ({ resource }) => {
    changeResource(io, socket, 'scarcity', 'add', resource);
  });

  socket.on('resource:removeAbundance', ({ resource }) => {
    changeResource(io, socket, 'abundance', 'remove', resource);
  });

  socket.on('resource:removeScarcity', ({ resource }) => {
    changeResource(io, socket, 'scarcity', 'remove', resource);
  });

  socket.on('resource:addName', ({ name }) => {
    changeResource(io, socket, 'name', 'add', name);
  });

  socket.on('resource:removeName', ({ name }) => {
    changeResource(io, socket, 'name', 'remove', name);
  });

  // Drawing
  socket.on('draw:stroke', (raw) => {
    const room = drawingRoom(socket);
    if (!room) return;
    const { playerId } = socket.data as { playerId: string };

    const stroke = normalizeStroke(raw, room.nextSeq);
    if (!stroke) return;
    // Trust the server's identity, not the sender's claim.
    const placed = roomManager.appendStroke(room, { ...stroke, playerId });
    // Echoed to everyone, sender included, so all clients agree on z-order.
    io.to(room.state.roomId).emit('draw:stroke', placed);
  });

  socket.on('draw:undo', () => {
    const room = drawingRoom(socket);
    if (!room) return;
    const { playerId } = socket.data as { playerId: string };
    const removed = roomManager.undoStroke(room, playerId);
    if (removed) {
      io.to(room.state.roomId).emit('draw:remove', { playerId, strokeId: removed.id });
    }
  });

  socket.on('draw:redo', () => {
    const room = drawingRoom(socket);
    if (!room) return;
    const { playerId } = socket.data as { playerId: string };
    const restored = roomManager.redoStroke(room, playerId);
    if (restored) {
      io.to(room.state.roomId).emit('draw:restore', restored);
    }
  });

  socket.on('draw:clear', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!roomManager.isHost(room, playerId)) {
      socket.emit('room:error', { message: 'Only the host can clear the map' });
      return;
    }
    roomManager.clearStrokes(room);
    io.to(roomId).emit('draw:history', []);
  });

  socket.on('draw:load', ({ strokes }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!roomManager.isHost(room, playerId)) {
      socket.emit('room:error', { message: 'Only the host can load a map file' });
      return;
    }
    const loaded = roomManager.replaceStrokes(room, normalizeStrokes(strokes));
    io.to(roomId).emit('draw:history', loaded);
  });

  // Admin: who may draw
  socket.on('admin:setDrawPermission', ({ playerId: targetId, canDraw }) => {
    const room = adminRoom(socket);
    if (!room) return;
    if (!roomManager.setDrawPermission(room, targetId, canDraw)) return;
    broadcastRoomState(io, room.state.roomId);
    if (room.game) broadcastGameState(io, room.state.roomId);
  });

  socket.on('admin:setAllDrawPermissions', ({ canDraw }) => {
    const room = adminRoom(socket);
    if (!room) return;
    const { playerId: hostId } = socket.data as { playerId: string };
    for (const player of room.state.players) {
      // The host keeps their own access so they can never lock themselves out.
      if (player.id !== hostId) roomManager.setDrawPermission(room, player.id, canDraw);
    }
    broadcastRoomState(io, room.state.roomId);
    if (room.game) broadcastGameState(io, room.state.roomId);
  });

  socket.on('admin:setAllowMidGameJoin', ({ allow }) => {
    const room = adminRoom(socket);
    if (!room) return;
    roomManager.setAllowMidGameJoin(room, allow === true);
    broadcastRoomState(io, room.state.roomId);
  });

  socket.on('admin:reorderPlayers', ({ order }) => {
    const room = adminRoom(socket);
    if (!room) return;
    if (!Array.isArray(order) || !roomManager.reorderPlayers(room, order.map(String))) {
      socket.emit('room:error', { message: 'That turn order does not match the table' });
      return;
    }
    broadcastRoomState(io, room.state.roomId);
    if (room.game) broadcastGameState(io, room.state.roomId);
  });

  socket.on('admin:kickPlayer', ({ playerId: targetId }) => {
    const room = adminRoom(socket);
    if (!room) return;
    const removed = roomManager.kickPlayer(room, targetId);
    if (!removed) {
      socket.emit('room:error', { message: 'That player cannot be removed' });
      return;
    }
    const roomId = room.state.roomId;
    if (removed.socketId) {
      const kicked = io.sockets.sockets.get(removed.socketId);
      kicked?.emit('room:kicked', { message: 'The host removed you from the room' });
      kicked?.leave(roomId);
      if (kicked) kicked.data = {};
    }
    broadcastRoomState(io, roomId);
    if (room.game) broadcastGameState(io, roomId);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const result = roomManager.disconnectPlayer(socket.id);
    if (result) {
      broadcastRoomState(io, result.room.state.roomId);
      if (result.room.game) {
        broadcastGameState(io, result.room.state.roomId);
      }
    }
  });

}
