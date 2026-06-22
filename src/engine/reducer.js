// ---------------------------------------------------------------------------
// The game reducer: (state, action, board) -> new state.
//
// Pure and immutable — every action returns a brand-new state snapshot, never
// mutating the old one. That single property is what makes undo, replay and
// (later) multiplayer sync fall out for free, exactly as the Phase 3 key
// insight promises. `board` is read-only context (static geometry).
//
// Phase 4: after every state change we recompute `state.valid` once (the set of
// legal placements) and cache it. Build handlers and the UI both read that
// cache instead of re-validating per click.
// ---------------------------------------------------------------------------

import { PHASES, isSetupPhase } from './phases.js';
import { ACTIONS } from './actions.js';
import { RESOURCE_KEYS, emptyHand, handTotal, logEntry } from './setup.js';
import { canPlaceSettlement, canPlaceRoad } from './rules.js';
import { distribute } from './distribution.js';
import { BUILD_COSTS, computeValidPlacements } from './building.js';

const WIN_VP = 10;
const DISCARD_LIMIT = 7;

export function gameReducer(state, action, board) {
  const next = route(state, action, board);
  if (next === state) return state;
  // Pre-compute valid placements once, here — not on every click/render.
  return { ...next, valid: computeValidPlacements(next, board) };
}

function route(state, action, board) {
  switch (action.type) {
    case ACTIONS.PLACE_SETTLEMENT:
      return placeSettlement(state, board, action.vertexId);
    case ACTIONS.PLACE_ROAD:
      return placeRoad(state, board, action.edgeId);
    case ACTIONS.BUILD_ROAD:
      return buildRoad(state, action.edgeId);
    case ACTIONS.BUILD_SETTLEMENT:
      return buildSettlement(state, action.vertexId);
    case ACTIONS.BUILD_CITY:
      return buildCity(state, action.vertexId);
    case ACTIONS.ROLL_DICE:
      return rollDice(state, board, action.dice);
    case ACTIONS.MOVE_ROBBER:
      return moveRobber(state, board, action.hexId);
    case ACTIONS.STEAL:
      return steal(state, action.fromPlayer, action.resource);
    case ACTIONS.NEXT_PHASE:
      return nextPhase(state);
    case ACTIONS.END_TURN:
      return endTurn(state);
    default:
      return state;
  }
}

// --- helpers ---------------------------------------------------------------

const playerName = (state, id) => state.players[id].name;

function log(state, text) {
  return { ...state, log: [...state.log, logEntry(state.turn, text)].slice(-60) };
}

function updatePlayer(state, playerId, updater) {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? updater(p) : p)),
  };
}

/** Move `grants` from the bank into a player's hand (capped at what's left). */
function grantFromBank(state, playerId, grants) {
  const bank = { ...state.bank };
  const taken = emptyHand();
  for (const r of RESOURCE_KEYS) {
    taken[r] = Math.min(grants[r] ?? 0, bank[r]);
    bank[r] -= taken[r];
  }
  return updatePlayer({ ...state, bank }, playerId, (p) => ({
    ...p,
    resources: RESOURCE_KEYS.reduce(
      (res, r) => ({ ...res, [r]: res[r] + taken[r] }),
      { ...p.resources },
    ),
  }));
}

/** Spend a build cost: cards leave the player and return to the bank. */
function payCost(state, playerId, cost) {
  const bank = { ...state.bank };
  for (const r of Object.keys(cost)) bank[r] += cost[r];
  return updatePlayer({ ...state, bank }, playerId, (p) => {
    const resources = { ...p.resources };
    for (const r of Object.keys(cost)) resources[r] -= cost[r];
    return { ...p, resources };
  });
}

function checkWin(state, playerId) {
  if (state.players[playerId].victoryPoints >= WIN_VP) {
    return log({ ...state, phase: PHASES.GAME_OVER, winner: playerId }, `${playerName(state, playerId)} wins!`);
  }
  return state;
}

// --- setup -----------------------------------------------------------------

function placeSettlement(state, board, vertexId) {
  if (!isSetupPhase(state.phase) || state.awaitingRoad) return state;
  const player = state.currentPlayer;
  if (!canPlaceSettlement(state, board, vertexId, { setup: true, player })) return state;

  let next = {
    ...state,
    buildings: { ...state.buildings, [vertexId]: { type: 'settlement', player } },
  };
  next = updatePlayer(next, player, (p) => ({
    ...p,
    settlements: p.settlements + 1,
    victoryPoints: p.victoryPoints + 1,
  }));

  // The second settlement (reverse pass) immediately collects resources from
  // all adjacent tiles.
  if (state.phase === PHASES.SETUP_REVERSE) {
    const grants = emptyHand();
    for (const hid of board.vertices.get(vertexId).hexIds) {
      const hex = board.hexes.get(hid);
      if (hex.yields) grants[hex.yields] += 1;
    }
    next = grantFromBank(next, player, grants);
    if (handTotal(grants) > 0) {
      next = log(next, `${playerName(state, player)} collects starting resources`);
    }
  }

  next = { ...next, awaitingRoad: true, lastSettlement: vertexId };
  return log(next, `${playerName(state, player)} placed a settlement`);
}

function placeRoad(state, board, edgeId) {
  const player = state.currentPlayer;
  if (!isSetupPhase(state.phase) || !state.awaitingRoad) return state;
  if (!canPlaceRoad(state, board, edgeId, { setup: true, player, settlementVertex: state.lastSettlement })) {
    return state;
  }

  let next = { ...state, roads: { ...state.roads, [edgeId]: player } };
  next = updatePlayer(next, player, (p) => ({ ...p, roads: p.roads + 1 }));
  next = { ...next, awaitingRoad: false, lastSettlement: null };
  return advanceSetup(next);
}

function advanceSetup(state) {
  const setupIndex = state.setupIndex + 1;

  if (setupIndex >= state.setupOrder.length) {
    const first = state.setupOrder[0];
    const next = { ...state, setupIndex, phase: PHASES.ROLL, currentPlayer: first, turn: 1 };
    return log(next, `Setup complete — ${playerName(state, first)} to roll`);
  }

  const nextPlayer = state.setupOrder[setupIndex];
  const phase = setupIndex < state.players.length ? PHASES.SETUP_FORWARD : PHASES.SETUP_REVERSE;
  const next = { ...state, setupIndex, currentPlayer: nextPlayer, phase };
  return log(next, `${playerName(state, nextPlayer)} to place a settlement`);
}

// --- building (BUILD phase, costs resources) -------------------------------

function buildRoad(state, edgeId) {
  if (state.phase !== PHASES.BUILD || !state.valid?.roads.includes(edgeId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.road);
  next = { ...next, roads: { ...next.roads, [edgeId]: player } };
  next = updatePlayer(next, player, (p) => ({ ...p, roads: p.roads + 1 }));
  return log(next, `${playerName(state, player)} built a road`);
}

function buildSettlement(state, vertexId) {
  if (state.phase !== PHASES.BUILD || !state.valid?.settlements.includes(vertexId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.settlement);
  next = { ...next, buildings: { ...next.buildings, [vertexId]: { type: 'settlement', player } } };
  next = updatePlayer(next, player, (p) => ({
    ...p,
    settlements: p.settlements + 1,
    victoryPoints: p.victoryPoints + 1,
  }));
  next = log(next, `${playerName(state, player)} built a settlement`);
  return checkWin(next, player);
}

function buildCity(state, vertexId) {
  if (state.phase !== PHASES.BUILD || !state.valid?.cities.includes(vertexId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.city);
  // Upgrade in place; the settlement piece returns to the player's supply.
  next = { ...next, buildings: { ...next.buildings, [vertexId]: { type: 'city', player } } };
  next = updatePlayer(next, player, (p) => ({
    ...p,
    settlements: p.settlements - 1,
    cities: p.cities + 1,
    victoryPoints: p.victoryPoints + 1,
  }));
  next = log(next, `${playerName(state, player)} upgraded to a city`);
  return checkWin(next, player);
}

// --- main loop -------------------------------------------------------------

function rollDice(state, board, dice) {
  if (state.phase !== PHASES.ROLL) return state;
  const total = dice[0] + dice[1];
  let next = { ...state, dice, diceTotal: total };
  next = log(next, `${playerName(state, state.currentPlayer)} rolled ${total} (${dice[0]} + ${dice[1]})`);

  if (total === 7) {
    next = applyDiscards(next);
    next = log(next, `Seven! ${playerName(state, state.currentPlayer)} moves the robber`);
    return { ...next, phase: PHASES.MOVE_ROBBER };
  }

  const { players, bank, gains } = distribute(next, board, total);
  next = { ...next, players, bank };
  const produced = Object.entries(gains)
    .filter(([, g]) => handTotal(g) > 0)
    .map(([pid, g]) => `${players[pid].name} +${handTotal(g)}`);
  next = log(next, produced.length ? `Produced: ${produced.join(', ')}` : 'No resources produced');
  return { ...next, phase: PHASES.TRADE };
}

/** On a 7, every player holding more than 7 cards discards half (rounded down).
 *  Auto-selected from their largest stacks to stay deterministic & replayable. */
function applyDiscards(state) {
  const bank = { ...state.bank };
  const discarded = [];

  const players = state.players.map((p) => {
    const total = handTotal(p.resources);
    if (total <= DISCARD_LIMIT) return p;
    let toDiscard = Math.floor(total / 2);
    const resources = { ...p.resources };
    while (toDiscard > 0) {
      const r = RESOURCE_KEYS.reduce((a, b) => (resources[b] > resources[a] ? b : a));
      if (resources[r] <= 0) break;
      resources[r] -= 1;
      bank[r] += 1;
      toDiscard -= 1;
    }
    discarded.push(`${p.name} discards ${Math.floor(total / 2)}`);
    return { ...p, resources };
  });

  let next = { ...state, players, bank };
  for (const text of discarded) next = log(next, text);
  return next;
}

function moveRobber(state, board, hexId) {
  if (state.phase !== PHASES.MOVE_ROBBER) return state;
  if (hexId === state.robberHex) return state; // must actually move it

  let next = { ...state, robberHex: hexId };
  next = log(next, `${playerName(state, state.currentPlayer)} moved the robber`);

  const candidates = new Set();
  for (const vid of board.hexes.get(hexId).vertexIds) {
    const building = state.buildings[vid];
    if (building && building.player !== state.currentPlayer) {
      if (handTotal(state.players[building.player].resources) > 0) {
        candidates.add(building.player);
      }
    }
  }

  const list = [...candidates];
  if (list.length === 0) {
    return { ...next, pendingSteal: null, phase: PHASES.TRADE };
  }
  return { ...next, pendingSteal: { candidates: list } };
}

function steal(state, fromPlayer, resource) {
  if (!state.pendingSteal) return state;
  let next = state;
  if (fromPlayer != null && resource) {
    next = updatePlayer(next, fromPlayer, (p) => ({
      ...p,
      resources: { ...p.resources, [resource]: p.resources[resource] - 1 },
    }));
    next = updatePlayer(next, state.currentPlayer, (p) => ({
      ...p,
      resources: { ...p.resources, [resource]: p.resources[resource] + 1 },
    }));
    next = log(next, `${playerName(state, state.currentPlayer)} stole a card from ${playerName(state, fromPlayer)}`);
  }
  return { ...next, pendingSteal: null, phase: PHASES.TRADE };
}

// --- phase navigation ------------------------------------------------------

function nextPhase(state) {
  if (state.phase === PHASES.TRADE) return { ...state, phase: PHASES.BUILD };
  if (state.phase === PHASES.BUILD) return endTurn(state);
  return state;
}

function endTurn(state) {
  if (state.phase !== PHASES.TRADE && state.phase !== PHASES.BUILD) return state;

  const nextPlayer = (state.currentPlayer + 1) % state.players.length;
  const next = {
    ...state,
    currentPlayer: nextPlayer,
    phase: PHASES.ROLL,
    dice: null,
    diceTotal: null,
    turn: state.turn + 1,
  };
  return log(next, `${playerName(state, nextPlayer)}'s turn`);
}
