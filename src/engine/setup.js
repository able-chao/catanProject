// Initial game state + player/resource definitions.

import { PHASES } from './phases.js';

export const RESOURCE_KEYS = ['lumber', 'wool', 'grain', 'ore', 'brick'];

export const RESOURCE_LABEL = {
  lumber: 'Wood',
  wool: 'Sheep',
  grain: 'Wheat',
  ore: 'Ore',
  brick: 'Brick',
};

export const RESOURCE_COLOR = {
  lumber: '#3f7a34',
  wool: '#8fbf57',
  grain: '#e6b422',
  ore: '#9aa3ad',
  brick: '#c45a3b',
};

export const PLAYER_PRESETS = [
  { name: 'Red', color: '#e23b3b' },
  { name: 'Blue', color: '#3b74e2' },
  { name: 'Orange', color: '#e2873b' },
  { name: 'White', color: '#dfe3ea' },
];

const BANK_PER_RESOURCE = 19;

export function emptyHand() {
  return { lumber: 0, wool: 0, grain: 0, ore: 0, brick: 0 };
}

export function handTotal(hand) {
  return RESOURCE_KEYS.reduce((sum, r) => sum + hand[r], 0);
}

export function logEntry(turn, text) {
  return { id: `${turn}-${Math.random().toString(36).slice(2, 7)}`, turn, text };
}

/**
 * Build the starting game state for `playerCount` players.
 * Setup order is a snake draft: 1→N forward, then N→1 reverse.
 */
export function createInitialGame(board, playerCount = 4) {
  const players = PLAYER_PRESETS.slice(0, playerCount).map((p, i) => ({
    id: i,
    name: p.name,
    color: p.color,
    resources: emptyHand(),
    settlements: 0,
    cities: 0,
    roads: 0,
    victoryPoints: 0,
  }));

  const forward = players.map((p) => p.id);
  const setupOrder = [...forward, ...forward.slice().reverse()];

  const desert = [...board.hexes.values()].find((h) => h.resource === 'desert');

  return {
    seed: board.seed,
    phase: PHASES.SETUP_FORWARD,
    players,
    currentPlayer: setupOrder[0],
    setupOrder,
    setupIndex: 0,
    awaitingRoad: false,
    lastSettlement: null,
    buildings: {}, // vertexId -> { type: 'settlement' | 'city', player }
    roads: {}, //    edgeId   -> playerId
    robberHex: desert ? desert.id : board.hexOrder[0],
    dice: null,
    diceTotal: null,
    bank: RESOURCE_KEYS.reduce((b, r) => ({ ...b, [r]: BANK_PER_RESOURCE }), {}),
    pendingSteal: null, // { candidates: [playerId, ...] }
    turn: 0,
    winner: null,
    log: [logEntry(0, `${players[0].name} places the first settlement`)],
  };
}
