// Client socket layer. Wires server events into the store and exposes outgoing
// emitters. The store never imports this file (one-way dependency, no cycle).

import { io } from 'socket.io-client';
import { useGameStore } from '../engine/store.js';

const URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

let socket = null;

function ensure() {
  if (socket) return socket;
  socket = io(URL);
  const store = () => useGameStore.getState();

  socket.on('connect', () => useGameStore.setState({ connected: true, serverError: null }));
  socket.on('disconnect', () => useGameStore.setState({ connected: false }));
  socket.on('connect_error', () => store()._onError('Cannot reach server — is it running on :3001?'));

  socket.on('LOBBY_UPDATE', ({ room, seat }) => store()._onLobby(room, seat));
  socket.on('GAME_STARTED', ({ game }) => store()._onGameStarted(game));
  socket.on('STATE_UPDATE', ({ game }) => store()._onState(game));
  socket.on('CHAT', (msg) => store()._onChat(msg));
  socket.on('ERROR_MSG', (m) => store()._onError(m));

  useGameStore.setState({ _emitAction: (action) => socket.emit('ACTION', { action }) });
  return socket;
}

export const net = {
  createRoom: (name) => ensure().emit('CREATE_ROOM', { name }),
  joinRoom: (code, name) => ensure().emit('JOIN_ROOM', { code, name }),
  setColor: (color) => ensure().emit('SET_COLOR', { color }),
  setMap: (mapId) => ensure().emit('SET_MAP', { mapId }),
  toggleReady: () => ensure().emit('PLAYER_READY'),
  startGame: () => ensure().emit('START_GAME'),
  sendChat: (text) => ensure().emit('CHAT', { text }),
  leave: () => socket?.emit('LEAVE'),
};
