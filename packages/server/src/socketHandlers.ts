import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, GameState, Stroke } from '@quiet-year/shared';
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
  socket.on('draw:stroke', (stroke: Stroke) => {
    const { roomId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    room.strokes.push(stroke);
    socket.to(roomId).emit('draw:stroke', stroke);
  });

  socket.on('draw:undo', () => {
    const { roomId, playerId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    // Find and remove the last stroke by this player
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].playerId === playerId) {
        const removed = room.strokes.splice(i, 1)[0];
        io.to(roomId).emit('draw:undo', { playerId, strokeId: removed.id });
        break;
      }
    }
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

  // Send stroke history on connection to a room
  socket.on('room:join', () => {
    const { roomId } = socket.data as { roomId: string; playerId: string };
    const room = roomManager.getRoom(roomId);
    if (room && room.strokes.length > 0) {
      socket.emit('draw:history', room.strokes);
    }
  });
}
