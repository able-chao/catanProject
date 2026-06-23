// ---------------------------------------------------------------------------
// The game reducer: (state, action, board) -> new state.
//
// Pure and immutable — every action returns a brand-new snapshot. Phase 5 adds
// bank/port trading, player-to-player trades, the dev-card system, Largest Army
// and Longest Road. After each change we recompute `state.valid` and check for
// a 10-VP win (now reachable: VP cards + the two special cards push past the
// 9-point building ceiling).
// ---------------------------------------------------------------------------

import { PHASES, isSetupPhase } from './phases.js';
import { ACTIONS } from './actions.js';
import { RESOURCE_KEYS, RESOURCE_LABEL, emptyHand, handTotal, logEntry, totalVictoryPoints } from './setup.js';
import { canPlaceSettlement, canPlaceRoad } from './rules.js';
import { distribute } from './distribution.js';
import { BUILD_COSTS, computeValidPlacements } from './building.js';
import { DEV_COST, emptyDevHand } from './devcards.js';
import { tradeRates, offerIsValid, hasBundle } from './trade.js';
import { awardLongestRoad } from './longestRoad.js';

const WIN_VP = 10;
const DISCARD_LIMIT = 7;

export function gameReducer(state, action, board) {
  let next = route(state, action, board);
  if (next === state) return state;
  next = maybeWin(next);
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
      return buildRoad(state, board, action.edgeId);
    case ACTIONS.BUILD_SETTLEMENT:
      return buildSettlement(state, board, action.vertexId);
    case ACTIONS.BUILD_CITY:
      return buildCity(state, action.vertexId);
    case ACTIONS.ROLL_DICE:
      return rollDice(state, board, action.dice);
    case ACTIONS.MOVE_ROBBER:
      return moveRobber(state, board, action.hexId);
    case ACTIONS.STEAL:
      return steal(state, action.fromPlayer, action.resource);
    case ACTIONS.END_TURN:
      return endTurn(state);

    case ACTIONS.BANK_TRADE:
      return bankTrade(state, board, action.give, action.get);
    case ACTIONS.PROPOSE_TRADE:
      return proposeTrade(state, action);
    case ACTIONS.ACCEPT_TRADE:
      return acceptTrade(state, action.playerId);
    case ACTIONS.DECLINE_TRADE:
      return declineTrade(state, action.playerId);
    case ACTIONS.CANCEL_TRADE:
      return state.pendingTrade ? log({ ...state, pendingTrade: null }, 'Trade offer withdrawn') : state;
    case ACTIONS.BUY_DEV:
      return buyDev(state);
    case ACTIONS.PLAY_KNIGHT:
      return playKnight(state);
    case ACTIONS.PLAY_ROAD_BUILDING:
      return playRoadBuilding(state);
    case ACTIONS.PLACE_FREE_ROAD:
      return placeFreeRoad(state, board, action.edgeId);
    case ACTIONS.SKIP_ROAD_BUILDING:
      return state.pendingRoadBuilding > 0 ? { ...state, pendingRoadBuilding: 0 } : state;
    case ACTIONS.PLAY_YEAR_OF_PLENTY:
      return playYearOfPlenty(state);
    case ACTIONS.PICK_YEAR_OF_PLENTY:
      return pickYearOfPlenty(state, action.resources);
    case ACTIONS.PLAY_MONOPOLY:
      return playMonopoly(state);
    case ACTIONS.PICK_MONOPOLY:
      return pickMonopoly(state, action.resource);
    default:
      return state;
  }
}

// --- helpers ---------------------------------------------------------------

const playerName = (state, id) => state.players[id].name;

// `player` tags the acting player for log colour-coding; null = system event.
function log(state, text, player = state.currentPlayer) {
  return { ...state, log: [...state.log, logEntry(state.turn, text, player)].slice(-80) };
}

function updatePlayer(state, playerId, updater) {
  return { ...state, players: state.players.map((p) => (p.id === playerId ? updater(p) : p)) };
}

function addBundle(resources, bundle) {
  const r = { ...resources };
  for (const k of Object.keys(bundle)) r[k] = (r[k] ?? 0) + bundle[k];
  return r;
}
function subBundle(resources, bundle) {
  const r = { ...resources };
  for (const k of Object.keys(bundle)) r[k] = (r[k] ?? 0) - bundle[k];
  return r;
}

function grantFromBank(state, playerId, grants) {
  const bank = { ...state.bank };
  const taken = emptyHand();
  for (const r of RESOURCE_KEYS) {
    taken[r] = Math.min(grants[r] ?? 0, bank[r]);
    bank[r] -= taken[r];
  }
  return updatePlayer({ ...state, bank }, playerId, (p) => ({ ...p, resources: addBundle(p.resources, taken) }));
}

function payCost(state, playerId, cost) {
  const bank = { ...state.bank };
  for (const r of Object.keys(cost)) bank[r] += cost[r];
  return updatePlayer({ ...state, bank }, playerId, (p) => ({ ...p, resources: subBundle(p.resources, cost) }));
}

function maybeWin(state) {
  if (state.phase === PHASES.GAME_OVER || isSetupPhase(state.phase)) return state;
  const cp = state.currentPlayer;
  if (totalVictoryPoints(state, cp) >= WIN_VP) {
    return log({ ...state, phase: PHASES.GAME_OVER, winner: cp }, `${playerName(state, cp)} wins with ${totalVictoryPoints(state, cp)} points!`);
  }
  return state;
}

/** Re-award Largest Army (3+ knights, strict lead) to the current player. */
function withLargestArmy(state) {
  const p = state.currentPlayer;
  const knights = state.players[p].knightsPlayed;
  if (knights < 3 || state.largestArmy === p) return state;
  const prevCount = state.largestArmy != null ? state.players[state.largestArmy].knightsPlayed : 0;
  if (knights > prevCount) {
    return log({ ...state, largestArmy: p }, `${playerName(state, p)} takes Largest Army (${knights} knights)`);
  }
  return state;
}

/** Recompute and re-award Longest Road after a road/settlement change. */
function withLongestRoad(state, board) {
  const { holder, length } = awardLongestRoad(state, board);
  if (holder === state.longestRoad) {
    return length === state.longestRoadLength ? state : { ...state, longestRoadLength: length };
  }
  let next = { ...state, longestRoad: holder, longestRoadLength: length };
  if (holder != null) next = log(next, `${playerName(state, holder)} takes Longest Road (${length})`, holder);
  else next = log(next, 'Longest Road is now unclaimed', null);
  return next;
}

// --- setup -----------------------------------------------------------------

function placeSettlement(state, board, vertexId) {
  if (!isSetupPhase(state.phase) || state.awaitingRoad) return state;
  const player = state.currentPlayer;
  if (!canPlaceSettlement(state, board, vertexId, { setup: true, player })) return state;

  let next = { ...state, buildings: { ...state.buildings, [vertexId]: { type: 'settlement', player } } };
  next = updatePlayer(next, player, (p) => ({ ...p, settlements: p.settlements + 1, victoryPoints: p.victoryPoints + 1 }));

  if (state.phase === PHASES.SETUP_REVERSE) {
    const grants = emptyHand();
    for (const hid of board.vertices.get(vertexId).hexIds) {
      const hex = board.hexes.get(hid);
      if (hex.yields) grants[hex.yields] += 1;
    }
    next = grantFromBank(next, player, grants);
    if (handTotal(grants) > 0) next = log(next, `${playerName(state, player)} collects starting resources`);
  }

  next = { ...next, awaitingRoad: true, lastSettlement: vertexId };
  return log(next, `${playerName(state, player)} placed a settlement`);
}

function placeRoad(state, board, edgeId) {
  const player = state.currentPlayer;
  if (!isSetupPhase(state.phase) || !state.awaitingRoad) return state;
  if (!canPlaceRoad(state, board, edgeId, { setup: true, player, settlementVertex: state.lastSettlement })) return state;

  let next = { ...state, roads: { ...state.roads, [edgeId]: player } };
  next = updatePlayer(next, player, (p) => ({ ...p, roads: p.roads + 1 }));
  next = { ...next, awaitingRoad: false, lastSettlement: null };
  return advanceSetup(next);
}

function advanceSetup(state) {
  const setupIndex = state.setupIndex + 1;
  if (setupIndex >= state.setupOrder.length) {
    const first = state.setupOrder[0];
    return log({ ...state, setupIndex, phase: PHASES.ROLL, currentPlayer: first, turn: 1 }, `Setup complete — ${playerName(state, first)} to roll`);
  }
  const nextPlayer = state.setupOrder[setupIndex];
  const phase = setupIndex < state.players.length ? PHASES.SETUP_FORWARD : PHASES.SETUP_REVERSE;
  return log({ ...state, setupIndex, currentPlayer: nextPlayer, phase }, `${playerName(state, nextPlayer)} to place a settlement`);
}

// --- building --------------------------------------------------------------

function buildRoad(state, board, edgeId) {
  if (state.phase !== PHASES.MAIN || !state.valid?.roads.includes(edgeId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.road);
  next = { ...next, roads: { ...next.roads, [edgeId]: player } };
  next = updatePlayer(next, player, (p) => ({ ...p, roads: p.roads + 1 }));
  next = log(next, `${playerName(state, player)} built a road`);
  return withLongestRoad(next, board);
}

function buildSettlement(state, board, vertexId) {
  if (state.phase !== PHASES.MAIN || !state.valid?.settlements.includes(vertexId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.settlement);
  next = { ...next, buildings: { ...next.buildings, [vertexId]: { type: 'settlement', player } } };
  next = updatePlayer(next, player, (p) => ({ ...p, settlements: p.settlements + 1, victoryPoints: p.victoryPoints + 1 }));
  next = log(next, `${playerName(state, player)} built a settlement`);
  return withLongestRoad(next, board); // a new settlement can break an opponent's road
}

function buildCity(state, vertexId) {
  if (state.phase !== PHASES.MAIN || !state.valid?.cities.includes(vertexId)) return state;
  const player = state.currentPlayer;
  let next = payCost(state, player, BUILD_COSTS.city);
  next = { ...next, buildings: { ...next.buildings, [vertexId]: { type: 'city', player } } };
  next = updatePlayer(next, player, (p) => ({ ...p, settlements: p.settlements - 1, cities: p.cities + 1, victoryPoints: p.victoryPoints + 1 }));
  return log(next, `${playerName(state, player)} upgraded to a city`);
}

// --- trading ---------------------------------------------------------------

function bankTrade(state, board, give, get) {
  if (state.phase !== PHASES.MAIN || state.pendingTrade) return state;
  const p = state.currentPlayer;
  const rate = tradeRates(state, board, p)[give];
  if (state.players[p].resources[give] < rate || state.bank[get] < 1) return state;
  const bank = { ...state.bank, [give]: state.bank[give] + rate, [get]: state.bank[get] - 1 };
  let next = updatePlayer({ ...state, bank }, p, (pl) => ({
    ...pl,
    resources: { ...pl.resources, [give]: pl.resources[give] - rate, [get]: pl.resources[get] + 1 },
  }));
  return log(next, `${playerName(state, p)} traded ${rate} ${RESOURCE_LABEL[give]} → 1 ${RESOURCE_LABEL[get]} (bank)`);
}

function proposeTrade(state, { from, to, give, want }) {
  if (state.phase !== PHASES.MAIN) return state;
  // The active player broadcasts (to=null); a responder may counter back to them.
  const validFrom = from === state.currentPlayer || (to === state.currentPlayer && from !== state.currentPlayer);
  if (!validFrom) return state;
  if (!hasBundle(state.players[from].resources, give)) return state;
  const next = { ...state, pendingTrade: { from, to: to ?? null, give, want, declined: [] } };
  const tag = to == null ? 'offers a trade' : `counters ${playerName(state, to)}`;
  return log(next, `${playerName(state, from)} ${tag}`);
}

function acceptTrade(state, playerId) {
  const t = state.pendingTrade;
  if (!t || playerId === t.from) return state;
  if (t.to != null && playerId !== t.to) return state;
  if (!offerIsValid(state, t.from, playerId, t.give, t.want)) return state;

  let next = updatePlayer(state, t.from, (p) => ({ ...p, resources: addBundle(subBundle(p.resources, t.give), t.want) }));
  next = updatePlayer(next, playerId, (p) => ({ ...p, resources: addBundle(subBundle(p.resources, t.want), t.give) }));
  next = { ...next, pendingTrade: null };
  return log(next, `${playerName(state, t.from)} ↔ ${playerName(state, playerId)} traded`);
}

function declineTrade(state, playerId) {
  const t = state.pendingTrade;
  if (!t || t.declined.includes(playerId)) return state;
  return { ...state, pendingTrade: { ...t, declined: [...t.declined, playerId] } };
}

// --- dev cards -------------------------------------------------------------

function canPlayDev(state) {
  return (
    state.phase === PHASES.MAIN &&
    !state.playedDevThisTurn &&
    state.pendingRoadBuilding === 0 &&
    !state.pendingYearOfPlenty &&
    !state.pendingMonopoly &&
    !state.pendingTrade
  );
}

const playableCount = (state, type) =>
  state.players[state.currentPlayer].dev[type] - state.devBought[type];

function buyDev(state) {
  if (state.phase !== PHASES.MAIN || state.pendingTrade) return state;
  const p = state.currentPlayer;
  if (state.devDeck.length === 0 || !hasBundle(state.players[p].resources, DEV_COST)) return state;
  const deck = state.devDeck.slice();
  const card = deck.pop();
  let next = payCost(state, p, DEV_COST);
  next = { ...next, devDeck: deck, devBought: { ...next.devBought, [card]: next.devBought[card] + 1 } };
  next = updatePlayer(next, p, (pl) => ({ ...pl, dev: { ...pl.dev, [card]: pl.dev[card] + 1 } }));
  return log(next, `${playerName(state, p)} bought a development card`);
}

function playKnight(state) {
  if (!canPlayDev(state) || playableCount(state, 'knight') <= 0) return state;
  const p = state.currentPlayer;
  let next = updatePlayer(state, p, (pl) => ({ ...pl, dev: { ...pl.dev, knight: pl.dev.knight - 1 }, knightsPlayed: pl.knightsPlayed + 1 }));
  next = { ...next, playedDevThisTurn: true, robberReturnPhase: state.phase, robberFromKnight: true, phase: PHASES.MOVE_ROBBER };
  next = withLargestArmy(next);
  return log(next, `${playerName(state, p)} played a Knight`);
}

function playRoadBuilding(state) {
  if (!canPlayDev(state) || playableCount(state, 'roadBuilding') <= 0) return state;
  const p = state.currentPlayer;
  let next = updatePlayer(state, p, (pl) => ({ ...pl, dev: { ...pl.dev, roadBuilding: pl.dev.roadBuilding - 1 } }));
  next = { ...next, playedDevThisTurn: true, pendingRoadBuilding: 2 };
  return log(next, `${playerName(state, p)} played Road Building`);
}

function placeFreeRoad(state, board, edgeId) {
  if (state.pendingRoadBuilding <= 0 || !state.valid?.roads.includes(edgeId)) return state;
  const p = state.currentPlayer;
  let next = { ...state, roads: { ...state.roads, [edgeId]: p }, pendingRoadBuilding: state.pendingRoadBuilding - 1 };
  next = updatePlayer(next, p, (pl) => ({ ...pl, roads: pl.roads + 1 }));
  next = log(next, `${playerName(state, p)} placed a free road`);
  return withLongestRoad(next, board);
}

function playYearOfPlenty(state) {
  if (!canPlayDev(state) || playableCount(state, 'yearOfPlenty') <= 0) return state;
  const p = state.currentPlayer;
  let next = updatePlayer(state, p, (pl) => ({ ...pl, dev: { ...pl.dev, yearOfPlenty: pl.dev.yearOfPlenty - 1 } }));
  next = { ...next, playedDevThisTurn: true, pendingYearOfPlenty: true };
  return log(next, `${playerName(state, p)} played Year of Plenty`);
}

function pickYearOfPlenty(state, resources) {
  if (!state.pendingYearOfPlenty || !Array.isArray(resources) || resources.length !== 2) return state;
  const p = state.currentPlayer;
  const grants = emptyHand();
  for (const r of resources) grants[r] = (grants[r] ?? 0) + 1;
  // Need the bank to actually have them.
  for (const r of RESOURCE_KEYS) if ((grants[r] ?? 0) > state.bank[r]) return state;
  let next = grantFromBank({ ...state, pendingYearOfPlenty: false }, p, grants);
  return log(next, `${playerName(state, p)} took ${resources.map((r) => RESOURCE_LABEL[r]).join(' + ')}`);
}

function playMonopoly(state) {
  if (!canPlayDev(state) || playableCount(state, 'monopoly') <= 0) return state;
  const p = state.currentPlayer;
  let next = updatePlayer(state, p, (pl) => ({ ...pl, dev: { ...pl.dev, monopoly: pl.dev.monopoly - 1 } }));
  next = { ...next, playedDevThisTurn: true, pendingMonopoly: true };
  return log(next, `${playerName(state, p)} played Monopoly`);
}

function pickMonopoly(state, resource) {
  if (!state.pendingMonopoly || !RESOURCE_KEYS.includes(resource)) return state;
  const p = state.currentPlayer;
  let taken = 0;
  const players = state.players.map((pl) => {
    if (pl.id === p) return pl;
    taken += pl.resources[resource];
    return { ...pl, resources: { ...pl.resources, [resource]: 0 } };
  });
  let next = { ...state, players, pendingMonopoly: false };
  next = updatePlayer(next, p, (pl) => ({ ...pl, resources: { ...pl.resources, [resource]: pl.resources[resource] + taken } }));
  return log(next, `${playerName(state, p)} monopolised ${RESOURCE_LABEL[resource]} (+${taken})`);
}

// --- main loop -------------------------------------------------------------

function rollDice(state, board, dice) {
  if (state.phase !== PHASES.ROLL) return state;
  const total = dice[0] + dice[1];
  let next = { ...state, dice, diceTotal: total, rollCount: (state.rollCount ?? 0) + 1 };
  next = log(next, `${playerName(state, state.currentPlayer)} rolled ${total} (${dice[0]} + ${dice[1]})`);

  if (total === 7) {
    next = applyDiscards(next);
    next = log(next, `Seven! ${playerName(state, state.currentPlayer)} moves the robber`);
    return { ...next, phase: PHASES.MOVE_ROBBER, robberReturnPhase: PHASES.MAIN, robberFromKnight: false };
  }

  const { players, bank, gains } = distribute(next, board, total);
  next = { ...next, players, bank };
  const produced = Object.entries(gains).filter(([, g]) => handTotal(g) > 0).map(([pid, g]) => `${players[pid].name} +${handTotal(g)}`);
  next = log(next, produced.length ? `Produced: ${produced.join(', ')}` : 'No resources produced', null);
  return { ...next, phase: PHASES.MAIN };
}

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
  for (const text of discarded) next = log(next, text, null);
  return next;
}

function moveRobber(state, board, hexId) {
  if (state.phase !== PHASES.MOVE_ROBBER || hexId === state.robberHex) return state;
  const back = state.robberReturnPhase ?? PHASES.MAIN;
  let next = { ...state, robberHex: hexId };
  next = log(next, `${playerName(state, state.currentPlayer)} moved the robber`);

  const candidates = new Set();
  for (const vid of board.hexes.get(hexId).vertexIds) {
    const b = state.buildings[vid];
    if (b && b.player !== state.currentPlayer && handTotal(state.players[b.player].resources) > 0) candidates.add(b.player);
  }
  const list = [...candidates];
  if (list.length === 0) return { ...next, pendingSteal: null, phase: back };
  return { ...next, pendingSteal: { candidates: list } };
}

function steal(state, fromPlayer, resource) {
  if (!state.pendingSteal) return state;
  const back = state.robberReturnPhase ?? PHASES.MAIN;
  let next = state;
  if (fromPlayer != null && resource) {
    next = updatePlayer(next, fromPlayer, (p) => ({ ...p, resources: { ...p.resources, [resource]: p.resources[resource] - 1 } }));
    next = updatePlayer(next, state.currentPlayer, (p) => ({ ...p, resources: { ...p.resources, [resource]: p.resources[resource] + 1 } }));
    next = log(next, `${playerName(state, state.currentPlayer)} stole a card from ${playerName(state, fromPlayer)}`);
  }
  return { ...next, pendingSteal: null, phase: back };
}

// --- phase navigation ------------------------------------------------------

function endTurn(state) {
  if (state.phase !== PHASES.MAIN) return state;
  const nextPlayer = (state.currentPlayer + 1) % state.players.length;
  const next = {
    ...state,
    currentPlayer: nextPlayer,
    phase: PHASES.ROLL,
    dice: null,
    diceTotal: null,
    turn: state.turn + 1,
    playedDevThisTurn: false,
    devBought: emptyDevHand(), // reset "bought this turn" gating
    pendingTrade: null,
  };
  return log(next, `${playerName(state, nextPlayer)}'s turn`);
}
