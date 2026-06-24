// Dice resource distribution, including the official "bank runs low" rule.

import { RESOURCE_KEYS, emptyHand } from './setup.js';

/**
 * Work out who produces what for a given dice total.
 * Returns new `players` and `bank` plus a `gains` map (playerId -> hand) for
 * logging. Does not mutate the input state.
 *
 * Bank-low rule: if the bank can't cover everyone owed a resource, then —
 *  - if exactly one player is owed it, they take whatever remains;
 *  - if more than one player is owed it, nobody receives that resource.
 */
export function distribute(state, board, total) {
  const gains = {};
  const demand = emptyHand();

  for (const hex of board.hexes.values()) {
    if (hex.id === state.robberHex) continue; // robber blocks production
    if (!hex.token || hex.token.number !== total) continue;
    if (!hex.yields) continue; // desert

    for (const vid of hex.vertexIds) {
      const building = state.buildings[vid];
      if (!building) continue;
      const amount = building.type === 'city' ? 2 : 1;
      (gains[building.player] ??= emptyHand())[hex.yields] += amount;
      demand[hex.yields] += amount;
    }
  }

  const bank = { ...state.bank };
  for (const r of RESOURCE_KEYS) {
    if (demand[r] === 0 || demand[r] <= bank[r]) continue;
    const owed = Object.keys(gains).filter((pid) => gains[pid][r] > 0);
    if (owed.length === 1) {
      gains[owed[0]][r] = bank[r]; // sole claimant gets the remainder
    } else {
      for (const pid of owed) gains[pid][r] = 0; // contested shortage -> nobody
    }
  }

  const players = state.players.map((p) => {
    const g = gains[p.id];
    if (!g) return p;
    const resources = { ...p.resources };
    for (const r of RESOURCE_KEYS) {
      resources[r] += g[r];
      bank[r] -= g[r];
    }
    return { ...p, resources };
  });

  return { players, bank, gains };
}
