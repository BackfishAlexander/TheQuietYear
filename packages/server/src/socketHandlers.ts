import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, GameState, normalizeStroke, normalizeStrokes } from '@quiet-year/shared';
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
    socket.emit('room:error', { message: 'Only the host can change drawing permissions' });
    return undefined;
  }
  return room;
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
    const result = roomManager.joinRoom(roomId.toUpperCase(), playerName, socket.id);
    if ('error' in result) {
      socket.emit('room:error', { message: result.error });
      return;
    }
    const { room, playerId } = result;
    socket.join(roomId.toUpperCase());
    socket.data = { roomId: roomId.toUpperCase(), playerId };
    socket.emit('room:joined', { playerId });
    broadcastRoomState(io, roomId.toUpperCase());
    socket.emit('draw:history', room.strokes);
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
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleAddAbundance(room.game, playerId, resource);
    broadcastGameState(io, roomId);
  });

  socket.on('resource:addScarcity', ({ resource }) => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleAddScarcity(room.game, playerId, resource);
    broadcastGameState(io, roomId);
  });

  socket.on('resource:removeAbundance', ({ resource }) => {
    const { roomId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleRemoveAbundance(room.game, resource);
    broadcastGameState(io, roomId);
  });

  socket.on('resource:removeScarcity', ({ resource }) => {
    const { roomId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleRemoveScarcity(room.game, resource);
    broadcastGameState(io, roomId);
  });

  socket.on('resource:addName', ({ name }) => {
    const { roomId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room?.game) return;
    room.game = gameManager.handleAddName(room.game, name);
    broadcastGameState(io, roomId);
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
