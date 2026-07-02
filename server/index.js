// ---------------------------------------------------------------------------
// Catan multiplayer server (Socket.io).
//
// The client is a DUMB VIEW: it sends typed action intents and renders the
// state the server broadcasts. ALL validation lives here — and, crucially, the
// server (not any client) generates dice and the stolen card via enrichAction.
//
// Persistence is in-memory (a Map of rooms). For production, swap `rooms` for
// Redis/a DB — the game state is plain JSON, so it serialises directly.
// ---------------------------------------------------------------------------

import { createServer } from 'node:http';
import { Server } from 'socket.io';

import { generateBoard } from '../src/board/board.js';
import { MAPS, DEFAULT_MAP } from '../src/board/maps.js';
import { createInitialGame } from '../src/engine/setup.js';
import { computeValidPlacements } from '../src/engine/building.js';
import { gameReducer } from '../src/engine/reducer.js';
import { enrichAction } from '../src/engine/enrich.js';
import { ACTIONS } from '../src/engine/actions.js';
import { PHASES } from '../src/engine/phases.js';
import { randomSeed } from '../src/utils/random.js';

const PORT = process.env.PORT || 3001;
const COLORS = ['#e23b3b', '#3b74e2', '#e2873b', '#dfe3ea'];
const TURN_TIMEOUT_MS = 30000; // auto-advance a disconnected player's turn
const MAX_PLAYERS = 4;
const MIN_PLAYERS = 2;

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

/** @type {Map<string, Room>} */
const rooms = new Map();
const socketRooms = new Map(); // socketId -> room code

// --- helpers ---------------------------------------------------------------

function newCode() {
  let code;
  do {
    code = Math.random().toString(36).slice(2, 6).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function ctx(socket) {
  const room = rooms.get(socketRooms.get(socket.id));
  const player = room?.players.find((p) => p.socketId === socket.id);
  return { room, player };
}

function lobbyView(room) {
  return {
    code: room.code,
    hostSeat: room.hostSeat,
    started: room.started,
    mapId: room.mapId,
    players: room.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      color: p.color,
      ready: p.ready,
      connected: p.connected,
    })),
  };
}

function broadcastLobby(room) {
  for (const p of room.players) {
    if (p.socketId) io.to(p.socketId).emit('LOBBY_UPDATE', { room: lobbyView(room), seat: p.seat });
  }
}

function broadcastState(room) {
  io.to(room.code).emit('STATE_UPDATE', { game: room.game });
}

function addPlayer(room, socket, name) {
  const seat = room.players.length;
  const used = new Set(room.players.map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c)) ?? COLORS[seat % COLORS.length];
  const player = {
    seat,
    socketId: socket.id,
    name: (name || `Player ${seat + 1}`).slice(0, 16),
    color,
    ready: false,
    connected: true,
  };
  room.players.push(player);
  socket.join(room.code);
  socketRooms.set(socket.id, room.code);
  return player;
}

// Which seat is allowed to issue this action?
function actorSeat(action, game) {
  switch (action.type) {
    case ACTIONS.PROPOSE_TRADE:
      return action.from;
    case ACTIONS.ACCEPT_TRADE:
    case ACTIONS.DECLINE_TRADE:
      return action.playerId;
    default:
      return game.currentPlayer;
  }
}

function applyAction(room, action) {
  const enriched = enrichAction(action, room.game);
  const next = gameReducer(room.game, enriched, room.board);
  if (next === room.game) return false;
  room.game = next;
  broadcastState(room);
  scheduleTimeout(room);
  return true;
}

// Keep the game moving if the player whose turn it is has disconnected.
function scheduleTimeout(room) {
  clearTimeout(room.timer);
  if (!room.started || room.game.phase === PHASES.GAME_OVER) return;
  const current = room.players.find((p) => p.seat === room.game.currentPlayer);
  if (!current || current.connected) return;
  room.timer = setTimeout(() => autoAdvance(room), TURN_TIMEOUT_MS);
}

function autoAction(g, board) {
  if (g.phase === PHASES.ROLL) return { type: ACTIONS.ROLL_DICE };
  if (g.phase === PHASES.MAIN) return { type: ACTIONS.END_TURN };
  if (g.phase === PHASES.MOVE_ROBBER) {
    return g.pendingSteal
      ? { type: ACTIONS.STEAL, fromPlayer: g.pendingSteal.candidates[0] }
      : { type: ACTIONS.MOVE_ROBBER, hexId: [...board.hexes.keys()].find((id) => id !== g.robberHex) };
  }
  return null; // setup needs real placement; just wait
}

function autoAdvance(room) {
  const action = autoAction(room.game, room.board);
  if (action) applyAction(room, action);
}

// --- socket wiring ---------------------------------------------------------

io.on('connection', (socket) => {
  socket.on('CREATE_ROOM', ({ name }) => {
    const room = { code: newCode(), hostSeat: 0, players: [], started: false, mapId: DEFAULT_MAP, board: null, game: null, timer: null };
    rooms.set(room.code, room);
    addPlayer(room, socket, name);
    broadcastLobby(room);
  });

  socket.on('JOIN_ROOM', ({ code, name }) => {
    const room = rooms.get((code || '').toUpperCase());
    if (!room) return socket.emit('ERROR_MSG', 'Room not found');

    if (room.started) {
      // Reconnect into a disconnected slot with the same name.
      const slot = room.players.find((p) => !p.connected && p.name === name);
      if (!slot) return socket.emit('ERROR_MSG', 'Game already started');
      slot.socketId = socket.id;
      slot.connected = true;
      socket.join(room.code);
      socketRooms.set(socket.id, room.code);
      socket.emit('GAME_STARTED', { game: room.game }); // full snapshot
      broadcastLobby(room);
      scheduleTimeout(room);
      return;
    }

    if (room.players.length >= MAX_PLAYERS) return socket.emit('ERROR_MSG', 'Room is full');
    addPlayer(room, socket, name);
    broadcastLobby(room);
  });

  // Host picks the map in the lobby; locked once the game starts.
  socket.on('SET_MAP', ({ mapId }) => {
    const { room, player } = ctx(socket);
    if (!room || room.started || !player || player.seat !== room.hostSeat) return;
    if (!MAPS[mapId]) return;
    room.mapId = mapId;
    broadcastLobby(room);
  });

  socket.on('SET_COLOR', ({ color }) => {
    const { room, player } = ctx(socket);
    if (!room || room.started || !player) return;
    if (!COLORS.includes(color) || room.players.some((p) => p !== player && p.color === color)) return;
    player.color = color;
    broadcastLobby(room);
  });

  socket.on('PLAYER_READY', () => {
    const { room, player } = ctx(socket);
    if (!room || room.started || !player) return;
    player.ready = !player.ready;
    broadcastLobby(room);
  });

  socket.on('START_GAME', () => {
    const { room, player } = ctx(socket);
    if (!room || room.started || !player || player.seat !== room.hostSeat) return;
    if (room.players.length < MIN_PLAYERS) return socket.emit('ERROR_MSG', `Need ${MIN_PLAYERS}+ players`);
    if (!room.players.every((p) => p.ready || p.seat === room.hostSeat)) {
      return socket.emit('ERROR_MSG', 'Not everyone is ready');
    }

    const board = generateBoard({ seed: randomSeed(), mapId: room.mapId });
    let game = createInitialGame(board, room.players.length);
    // Apply lobby names/colours and seed the placement cache.
    game = {
      ...game,
      players: game.players.map((pl, i) => ({ ...pl, name: room.players[i].name, color: room.players[i].color })),
    };
    game = { ...game, valid: computeValidPlacements(game, board) };

    room.board = board;
    room.game = game;
    room.started = true;
    io.to(room.code).emit('GAME_STARTED', { game: room.game });
    scheduleTimeout(room);
  });

  socket.on('ACTION', ({ action }) => {
    const { room, player } = ctx(socket);
    if (!room || !room.started || !player || !action) return;
    if (actorSeat(action, room.game) !== player.seat) {
      return socket.emit('ERROR_MSG', 'Not your move');
    }
    if (!applyAction(room, action)) socket.emit('ERROR_MSG', 'Illegal move');
  });

  socket.on('CHAT', ({ text }) => {
    const { room, player } = ctx(socket);
    if (!room || !player || !text) return;
    io.to(room.code).emit('CHAT', {
      seat: player.seat,
      name: player.name,
      color: player.color,
      text: String(text).slice(0, 240),
      ts: Date.now(),
    });
  });

  socket.on('LEAVE', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

function handleLeave(socket) {
  const code = socketRooms.get(socket.id);
  socketRooms.delete(socket.id);
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.find((p) => p.socketId === socket.id);
  if (!player) return;

  if (room.started) {
    // Keep the slot for reconnection; auto-advance if it's their turn.
    player.connected = false;
    player.socketId = null;
    broadcastLobby(room);
    scheduleTimeout(room);
    return;
  }

  // Pre-game: drop the player and re-seat the rest.
  room.players = room.players.filter((p) => p !== player);
  if (room.players.length === 0) {
    clearTimeout(room.timer);
    rooms.delete(code);
    return;
  }
  room.players.forEach((p, i) => (p.seat = i));
  if (player.seat <= room.hostSeat || room.hostSeat >= room.players.length) room.hostSeat = 0;
  broadcastLobby(room);
}

httpServer.listen(PORT, () => {
  console.log(`Catan server listening on :${PORT}`);
});
