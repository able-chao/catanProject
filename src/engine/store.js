// ---------------------------------------------------------------------------
// Zustand store. Holds the static board, the live game-state snapshot, and a
// stack of past snapshots for undo. Randomness (dice, the stolen card) is
// resolved here and passed into the reducer as action payload, keeping the
// reducer pure and the action log replayable.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { generateBoard } from '../board/board.js';
import { createInitialGame, RESOURCE_KEYS } from './setup.js';
import { gameReducer } from './reducer.js';
import { computeValidPlacements } from './building.js';
import { ACTIONS } from './actions.js';

const HISTORY_LIMIT = 100;

function freshGame(playerCount) {
  const board = generateBoard();
  const game = createInitialGame(board, playerCount);
  // Seed the precomputed placement cache for the opening settlement.
  return { board, game: { ...game, valid: computeValidPlacements(game, board) }, history: [] };
}

const d6 = () => 1 + Math.floor(Math.random() * 6);

export const useGameStore = create((set, get) => ({
  ...freshGame(4),

  // Dev overlays.
  show: { coords: false, vertices: false, edges: false },
  toggle: (key) => set((s) => ({ show: { ...s.show, [key]: !s.show[key] } })),

  /** Run an action through the reducer and snapshot the previous state. */
  dispatch: (action) => {
    const { game, board, history } = get();
    const next = gameReducer(game, action, board);
    if (next === game) return; // reducer rejected it (illegal move)
    set({ game: next, history: [...history, game].slice(-HISTORY_LIMIT) });
  },

  // --- player-facing actions (inject randomness, then dispatch) ---
  placeSettlement: (vertexId) => get().dispatch({ type: ACTIONS.PLACE_SETTLEMENT, vertexId }),
  placeRoad: (edgeId) => get().dispatch({ type: ACTIONS.PLACE_ROAD, edgeId }),
  buildRoad: (edgeId) => get().dispatch({ type: ACTIONS.BUILD_ROAD, edgeId }),
  buildSettlement: (vertexId) => get().dispatch({ type: ACTIONS.BUILD_SETTLEMENT, vertexId }),
  buildCity: (vertexId) => get().dispatch({ type: ACTIONS.BUILD_CITY, vertexId }),
  rollDice: () => get().dispatch({ type: ACTIONS.ROLL_DICE, dice: [d6(), d6()] }),
  moveRobber: (hexId) => get().dispatch({ type: ACTIONS.MOVE_ROBBER, hexId }),
  endTurn: () => get().dispatch({ type: ACTIONS.END_TURN }),

  // --- Phase 5: trading & dev cards ---
  bankTrade: (give, get_) => get().dispatch({ type: ACTIONS.BANK_TRADE, give, get: get_ }),
  proposeTrade: (offer) => get().dispatch({ type: ACTIONS.PROPOSE_TRADE, ...offer }),
  acceptTrade: (playerId) => get().dispatch({ type: ACTIONS.ACCEPT_TRADE, playerId }),
  declineTrade: (playerId) => get().dispatch({ type: ACTIONS.DECLINE_TRADE, playerId }),
  cancelTrade: () => get().dispatch({ type: ACTIONS.CANCEL_TRADE }),
  buyDev: () => get().dispatch({ type: ACTIONS.BUY_DEV }),
  playKnight: () => get().dispatch({ type: ACTIONS.PLAY_KNIGHT }),
  playRoadBuilding: () => get().dispatch({ type: ACTIONS.PLAY_ROAD_BUILDING }),
  placeFreeRoad: (edgeId) => get().dispatch({ type: ACTIONS.PLACE_FREE_ROAD, edgeId }),
  skipRoadBuilding: () => get().dispatch({ type: ACTIONS.SKIP_ROAD_BUILDING }),
  playYearOfPlenty: () => get().dispatch({ type: ACTIONS.PLAY_YEAR_OF_PLENTY }),
  pickYearOfPlenty: (resources) => get().dispatch({ type: ACTIONS.PICK_YEAR_OF_PLENTY, resources }),
  playMonopoly: () => get().dispatch({ type: ACTIONS.PLAY_MONOPOLY }),
  pickMonopoly: (resource) => get().dispatch({ type: ACTIONS.PICK_MONOPOLY, resource }),

  /** Steal a uniformly random card from the chosen victim. */
  stealFrom: (fromPlayer) => {
    const target = get().game.players[fromPlayer];
    const pool = [];
    for (const r of RESOURCE_KEYS) for (let i = 0; i < target.resources[r]; i++) pool.push(r);
    const resource = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    get().dispatch({ type: ACTIONS.STEAL, fromPlayer, resource });
  },

  /** Undo: pop the most recent snapshot. */
  undo: () =>
    set((s) => {
      if (!s.history.length) return s;
      return { game: s.history[s.history.length - 1], history: s.history.slice(0, -1) };
    }),

  newGame: (playerCount) => set(() => freshGame(playerCount ?? get().game.players.length)),
}));

// Dev-only handle for debugging/testing in the browser console (stripped from
// production builds).
if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__game = useGameStore;
}
