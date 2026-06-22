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
  nextPhase: () => get().dispatch({ type: ACTIONS.NEXT_PHASE }),
  endTurn: () => get().dispatch({ type: ACTIONS.END_TURN }),

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
