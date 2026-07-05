// ---------------------------------------------------------------------------
// Building economy: costs, supply limits, and the once-per-phase precompute of
// every legal placement.
//
// Per the Phase 4 outline, valid road/settlement/city spots are computed ONCE
// whenever the relevant state changes (entering BUILD, and after each build)
// and cached on `state.valid`. The UI only reads that cache — it never
// re-validates on a click or a render. The distance rule itself is the 1-edge-
// hop neighbour check in rules.js (BFS of depth 1 over precomputed adjacency).
// ---------------------------------------------------------------------------

import { PHASES, isSetupPhase } from './phases.js';
import { validSettlementSpots, validRoadSpots } from './rules.js';

export const BUILD_COSTS = {
  road: { lumber: 1, brick: 1 },
  settlement: { lumber: 1, brick: 1, wool: 1, grain: 1 },
  city: { grain: 2, ore: 3 },
};

// Pieces each player has in their supply (classic Catan limits).
export const SUPPLY_LIMITS = { roads: 15, settlements: 5, cities: 4 };

export function canAfford(hand, cost) {
  return Object.keys(cost).every((r) => hand[r] >= cost[r]);
}

/** Expand a cost object into a flat list of resource keys (for rendering). */
export function expandCost(cost) {
  return Object.entries(cost).flatMap(([r, n]) => Array(n).fill(r));
}

/**
 * All legal placements for the current player, given the current phase.
 * Setup returns only the one relevant kind; BUILD returns every kind that is
 * both legal *and* affordable *and* within supply, so highlights are honest.
 */
export function computeValidPlacements(state, board) {
  const none = { settlements: [], roads: [], cities: [] };
  const player = state.currentPlayer;

  // Gold picks must be resolved before anything else happens.
  if (state.pendingGold?.length) return none;

  // Road Building dev card: place free roads, regardless of TRADE/BUILD phase.
  if (state.pendingRoadBuilding > 0) {
    return { ...none, roads: validRoadSpots(state, board, { setup: false, player }) };
  }

  if (isSetupPhase(state.phase)) {
    if (state.awaitingRoad) {
      return {
        ...none,
        roads: validRoadSpots(state, board, {
          setup: true,
          player,
          settlementVertex: state.lastSettlement,
        }),
      };
    }
    return { ...none, settlements: validSettlementSpots(state, board, { setup: true }) };
  }

  if (state.phase === PHASES.MAIN) {
    const me = state.players[player];
    const hand = me.resources;

    const roads =
      canAfford(hand, BUILD_COSTS.road) && me.roads < SUPPLY_LIMITS.roads
        ? validRoadSpots(state, board, { setup: false, player })
        : [];

    const settlements =
      canAfford(hand, BUILD_COSTS.settlement) && me.settlements < SUPPLY_LIMITS.settlements
        ? validSettlementSpots(state, board, { setup: false, player })
        : [];

    // A city upgrades one of your own settlements in place.
    const cities =
      canAfford(hand, BUILD_COSTS.city) && me.cities < SUPPLY_LIMITS.cities
        ? [...board.vertices.keys()].filter((vid) => {
            const b = state.buildings[vid];
            return b && b.player === player && b.type === 'settlement';
          })
        : [];

    return { roads, settlements, cities };
  }

  return none;
}
