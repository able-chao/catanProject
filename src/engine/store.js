// ---------------------------------------------------------------------------
// Zustand store. Drives both local (hotseat) and online (networked) play.
//
// Action wrappers emit BARE intents through submit(): in local mode they're
// enriched (dice/steal randomness) and run through the reducer here; in online
// mode they're sent to the server, which is authoritative and broadcasts the
// new state back via _onState. The reducer never runs on the client online.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { generateBoard } from '../board/board.js';
import { createInitialGame } from './setup.js';
import { computeValidPlacements } from './building.js';
import { gameReducer } from './reducer.js';
import { enrichAction } from './enrich.js';
import { ACTIONS } from './actions.js';

const HISTORY_LIMIT = 100;

function freshGame(playerCount, mapId = 'classic') {
  const board = generateBoard({ mapId });
  const game = createInitialGame(board, playerCount);
  return { board, game: { ...game, valid: computeValidPlacements(game, board) }, history: [] };
}

export const useGameStore = create((set, get) => ({
  // --- view / networking ---
  view: 'home', // 'home' | 'lobby' | 'game'
  mode: 'local', // 'local' | 'online'
  mySeat: null, // my player id when online
  room: null, // lobby view from the server
  chat: [],
  connected: false,
  serverError: null,
  _emitAction: null, // injected by the socket layer

  // --- game ---
  board: null,
  game: null,
  history: [],

  show: { coords: false, vertices: false, edges: false },
  toggle: (key) => set((s) => ({ show: { ...s.show, [key]: !s.show[key] } })),

  // --- local lifecycle ---
  startLocal: (playerCount = 4, mapId = 'classic') =>
    set({ ...freshGame(playerCount, mapId), mode: 'local', view: 'game', mySeat: null, room: null }),
  // New game keeps the current map unless told otherwise.
  newGame: (playerCount) =>
    set((s) => freshGame(playerCount ?? s.game?.players.length ?? 4, s.game?.mapId ?? 'classic')),
  backToHome: () =>
    set({ view: 'home', mode: 'local', game: null, board: null, room: null, mySeat: null, chat: [], history: [] }),

  // --- dispatch ---
  dispatch: (action) => {
    const { game, board, history } = get();
    if (!game) return;
    const enriched = enrichAction(action, game);
    const next = gameReducer(game, enriched, board);
    if (next === game) return;
    set({ game: next, history: [...history, game].slice(-HISTORY_LIMIT) });
  },
  submit: (action) => {
    const s = get();
    if (s.mode === 'online') s._emitAction?.(action);
    else s.dispatch(action);
  },

  // --- action wrappers (bare intents) ---
  placeSettlement: (vertexId) => get().submit({ type: ACTIONS.PLACE_SETTLEMENT, vertexId }),
  placeRoad: (edgeId) => get().submit({ type: ACTIONS.PLACE_ROAD, edgeId }),
  buildRoad: (edgeId) => get().submit({ type: ACTIONS.BUILD_ROAD, edgeId }),
  buildSettlement: (vertexId) => get().submit({ type: ACTIONS.BUILD_SETTLEMENT, vertexId }),
  buildCity: (vertexId) => get().submit({ type: ACTIONS.BUILD_CITY, vertexId }),
  placeFreeRoad: (edgeId) => get().submit({ type: ACTIONS.PLACE_FREE_ROAD, edgeId }),
  rollDice: () => get().submit({ type: ACTIONS.ROLL_DICE }),
  moveRobber: (hexId) => get().submit({ type: ACTIONS.MOVE_ROBBER, hexId }),
  stealFrom: (fromPlayer) => get().submit({ type: ACTIONS.STEAL, fromPlayer }),
  endTurn: () => get().submit({ type: ACTIONS.END_TURN }),
  bankTrade: (give, getRes) => get().submit({ type: ACTIONS.BANK_TRADE, give, get: getRes }),
  proposeTrade: (offer) => get().submit({ type: ACTIONS.PROPOSE_TRADE, ...offer }),
  acceptTrade: (playerId) => get().submit({ type: ACTIONS.ACCEPT_TRADE, playerId }),
  declineTrade: (playerId) => get().submit({ type: ACTIONS.DECLINE_TRADE, playerId }),
  cancelTrade: () => get().submit({ type: ACTIONS.CANCEL_TRADE }),
  buyDev: () => get().submit({ type: ACTIONS.BUY_DEV }),
  playKnight: () => get().submit({ type: ACTIONS.PLAY_KNIGHT }),
  playRoadBuilding: () => get().submit({ type: ACTIONS.PLAY_ROAD_BUILDING }),
  skipRoadBuilding: () => get().submit({ type: ACTIONS.SKIP_ROAD_BUILDING }),
  playYearOfPlenty: () => get().submit({ type: ACTIONS.PLAY_YEAR_OF_PLENTY }),
  pickYearOfPlenty: (resources) => get().submit({ type: ACTIONS.PICK_YEAR_OF_PLENTY, resources }),
  playMonopoly: () => get().submit({ type: ACTIONS.PLAY_MONOPOLY }),
  pickMonopoly: (resource) => get().submit({ type: ACTIONS.PICK_MONOPOLY, resource }),

  undo: () =>
    set((s) => {
      if (s.mode !== 'local' || !s.history.length) return s;
      return { game: s.history[s.history.length - 1], history: s.history.slice(0, -1) };
    }),

  // --- online: setters called by the socket layer ---
  _onLobby: (room, seat) =>
    set((s) => ({ room, mySeat: seat, mode: 'online', view: room.started ? s.view : 'lobby', serverError: null })),
  _onGameStarted: (game) =>
    // Rebuild the identical board from (mapId, seed) — the board itself never
    // travels over the wire.
    set({ board: generateBoard({ seed: game.seed, mapId: game.mapId }), game, mode: 'online', view: 'game' }),
  _onState: (game) => set({ game }),
  _onChat: (msg) => set((s) => ({ chat: [...s.chat, msg].slice(-120) })),
  _onError: (msg) => set({ serverError: msg }),
  clearError: () => set({ serverError: null }),
}));

// Dev-only handle for debugging in the browser console (stripped from prod).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__game = useGameStore;
}
