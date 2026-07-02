// Initial game state + player/resource definitions.

import { PHASES } from './phases.js';
import { mulberry32 } from '../utils/random.js';
import { buildDevDeck, emptyDevHand } from './devcards.js';

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

export function logEntry(turn, text, player = null) {
  return { id: `${turn}-${Math.random().toString(36).slice(2, 7)}`, turn, text, player };
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
    dev: emptyDevHand(), // dev cards in hand
    knightsPlayed: 0,
    settlements: 0,
    cities: 0,
    roads: 0,
    victoryPoints: 0, // building VP only; bonuses added by totalVictoryPoints()
  }));

  const forward = players.map((p) => p.id);
  const setupOrder = [...forward, ...forward.slice().reverse()];

  // The robber starts on a non-producing tile — desert on classic, the lake on
  // maps that have one instead.
  const robberStart = [...board.hexes.values()].find((h) => h.yields == null);

  return {
    seed: board.seed,
    mapId: board.mapId,
    phase: PHASES.SETUP_FORWARD,
    players,
    currentPlayer: setupOrder[0],
    setupOrder,
    setupIndex: 0,
    awaitingRoad: false,
    lastSettlement: null,
    buildings: {}, // vertexId -> { type: 'settlement' | 'city', player }
    roads: {}, //    edgeId   -> playerId
    robberHex: robberStart ? robberStart.id : board.hexOrder[0],
    dice: null,
    diceTotal: null,
    rollCount: 0, // increments each roll (drives the dice animation)
    bank: RESOURCE_KEYS.reduce((b, r) => ({ ...b, [r]: BANK_PER_RESOURCE }), {}),
    pendingSteal: null, // { candidates: [playerId, ...] }

    // Phase 5 state
    devDeck: buildDevDeck(mulberry32(board.seed + 1)),
    devBought: emptyDevHand(), // bought THIS turn (can't be played yet)
    playedDevThisTurn: false,
    pendingRoadBuilding: 0, // free roads still to place
    pendingYearOfPlenty: false,
    pendingMonopoly: false,
    robberFromKnight: false, // distinguishes a knight robber from a 7
    largestArmy: null,
    longestRoad: null,
    longestRoadLength: 0,
    pendingTrade: null, // { from, to, give, want, declined: [ids] }

    turn: 0,
    winner: null,
    log: [logEntry(0, `${players[0].name} places the first settlement`, 0)],
  };
}

/** Building VP plus dev-card VP, Largest Army (+2) and Longest Road (+2). */
export function totalVictoryPoints(game, playerId) {
  const p = game.players[playerId];
  let vp = p.victoryPoints + (p.dev?.vp ?? 0);
  if (game.largestArmy === playerId) vp += 2;
  if (game.longestRoad === playerId) vp += 2;
  return vp;
}

/** Itemised VP for the end-screen breakdown. */
export function vpBreakdown(game, playerId) {
  const p = game.players[playerId];
  return [
    { label: 'Settlements', value: p.settlements },
    { label: 'Cities', value: p.cities * 2 },
    { label: 'VP cards', value: p.dev?.vp ?? 0 },
    { label: 'Longest Road', value: game.longestRoad === playerId ? 2 : 0 },
    { label: 'Largest Army', value: game.largestArmy === playerId ? 2 : 0 },
  ];
}
