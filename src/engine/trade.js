// ---------------------------------------------------------------------------
// Trade economics: bank / port rates and player-offer validation.
//
// Bank 4:1 is always available. A 3:1 generic port lowers every rate to 3, and
// a 2:1 specific port lowers that one resource to 2 — but only once the player
// has a building on one of the port's two coastal vertices.
// ---------------------------------------------------------------------------

import { RESOURCE_KEYS } from './setup.js';

/** Best give-rate per resource for a player (4 / 3 / 2). */
export function tradeRates(game, board, playerId) {
  const rates = {};
  for (const r of RESOURCE_KEYS) rates[r] = 4;

  let hasGeneric = false;
  for (const port of board.ports.values()) {
    const owns = port.vertexIds.some((vid) => game.buildings[vid]?.player === playerId);
    if (!owns) continue;
    if (port.yields) rates[port.yields] = Math.min(rates[port.yields], 2);
    else hasGeneric = true;
  }
  if (hasGeneric) {
    for (const r of RESOURCE_KEYS) rates[r] = Math.min(rates[r], 3);
  }
  return rates;
}

/** Total cards described by a {resource: count} bundle. */
export function bundleTotal(bundle) {
  return Object.values(bundle).reduce((s, n) => s + n, 0);
}

/** Does `hand` contain every card in `bundle`? */
export function hasBundle(hand, bundle) {
  return Object.entries(bundle).every(([r, n]) => hand[r] >= n);
}

/** A player-to-player offer is legal only if both sides actually have the cards
 *  and the offer isn't empty/one-sided-empty. */
export function offerIsValid(game, fromId, toId, give, want) {
  if (bundleTotal(give) === 0 && bundleTotal(want) === 0) return false;
  if (!hasBundle(game.players[fromId].resources, give)) return false;
  if (!hasBundle(game.players[toId].resources, want)) return false;
  return true;
}
