// ---------------------------------------------------------------------------
// Number tokens and their placement.
//
// Critical Catan rule: the "red" tokens — 6 and 8, the highest-probability
// rolls — may never sit on adjacent hexes. We satisfy it with rejection
// sampling: shuffle the map's token pool onto the producing hexes, validate,
// and retry on failure. With only a few red tokens a valid layout is common,
// so this converges in a handful of attempts. A swap-repair fallback
// guarantees termination.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

/** Pips (probability dots) for a number: 1 for 2/12 up to 5 for 6/8. */
export function pipCount(n) {
  return n === 7 ? 0 : 6 - Math.abs(7 - n);
}

/**
 * Build token objects from a map's number pool. Letters follow the classic
 * A, B, C… labelling in pool order (A–R for the classic 18, further for
 * bigger maps). Non-producing tiles (desert, lake) get no token.
 */
export function buildTokens(numbers) {
  return numbers.map((number, i) => ({
    letter: String.fromCharCode(65 + i),
    number,
    pips: pipCount(number),
    red: number === 6 || number === 8,
  }));
}

/** True if no two red (6/8) tokens are on neighbouring hexes. */
function isValidRedPlacement(numberByHex, hexes) {
  for (const [hexId, token] of numberByHex) {
    if (!token.red) continue;
    for (const neighborId of hexes.get(hexId).neighborIds) {
      const neighborToken = numberByHex.get(neighborId);
      if (neighborToken && neighborToken.red) return false;
    }
  }
  return true;
}

/**
 * Assign the map's number tokens to the producing hexes (walking board order)
 * such that no two red tokens are adjacent. Desert/lake tiles are skipped.
 * @returns {{ numberByHex: Map<hexId, token>, attempts: number }}
 */
export function placeTokens(hexOrder, hexes, rng, tokenNumbers, maxAttempts = 1000) {
  const targets = hexOrder.filter((id) => hexes.get(id).yields != null);
  const pool = buildTokens(tokenNumbers);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tokens = shuffle(pool, rng);
    const numberByHex = new Map();
    targets.forEach((hexId, i) => numberByHex.set(hexId, tokens[i]));
    if (isValidRedPlacement(numberByHex, hexes)) {
      return { numberByHex, attempts: attempt };
    }
  }

  // Fallback (extremely unlikely to be reached): repair by swapping any red
  // token that conflicts with a random non-red hex until valid.
  const tokens = shuffle(pool, rng);
  const numberByHex = new Map();
  targets.forEach((hexId, i) => numberByHex.set(hexId, tokens[i]));
  repairRedAdjacency(numberByHex, hexes, targets, rng);
  return { numberByHex, attempts: maxAttempts };
}

function repairRedAdjacency(numberByHex, hexes, targets, rng, maxSwaps = 500) {
  for (let i = 0; i < maxSwaps; i++) {
    if (isValidRedPlacement(numberByHex, hexes)) return;
    // Find a conflicting red hex and swap it with a random non-red hex.
    const conflict = targets.find((id) => {
      const t = numberByHex.get(id);
      return (
        t.red &&
        hexes.get(id).neighborIds.some((n) => numberByHex.get(n)?.red)
      );
    });
    if (!conflict) return;
    const nonRed = targets.filter((id) => !numberByHex.get(id).red);
    const swapWith = nonRed[Math.floor(rng() * nonRed.length)];
    const tmp = numberByHex.get(conflict);
    numberByHex.set(conflict, numberByHex.get(swapWith));
    numberByHex.set(swapWith, tmp);
  }
}
