// ---------------------------------------------------------------------------
// Number tokens (A–R) and their placement.
//
// Critical Catan rule: the "red" tokens — 6 and 8, the highest-probability
// rolls — may never sit on adjacent hexes. We satisfy it with rejection
// sampling: shuffle the 18 tokens onto the non-desert hexes, validate, and
// retry on failure. With only four red tokens among 18 hexes a valid layout is
// common, so this converges in a handful of attempts. A swap-repair fallback
// guarantees termination.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

/** Pips (probability dots) for a number: 1 for 2/12 up to 5 for 6/8. */
export function pipCount(n) {
  return n === 7 ? 0 : 6 - Math.abs(7 - n);
}

// The canonical 18 Catan tokens. Letters are the standard labels; the desert
// gets no token. Counts: one 2 & 12, two each of 3–6 and 8–11. No 7.
export const NUMBER_TOKENS = [
  ['A', 5], ['B', 2], ['C', 6], ['D', 3], ['E', 8], ['F', 10],
  ['G', 9], ['H', 12], ['I', 11], ['J', 4], ['K', 8], ['L', 10],
  ['M', 9], ['N', 5], ['O', 6], ['P', 3], ['Q', 11], ['R', 4],
].map(([letter, number]) => ({
  letter,
  number,
  pips: pipCount(number),
  red: number === 6 || number === 8,
}));

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
 * Assign number tokens to the non-desert hexes (walking spiral order) such that
 * no two red tokens are adjacent.
 * @returns {{ numberByHex: Map<hexId, token>, attempts: number }}
 */
export function placeTokens(hexOrder, hexes, rng, maxAttempts = 1000) {
  const targets = hexOrder.filter((id) => hexes.get(id).resource !== 'desert');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const tokens = shuffle(NUMBER_TOKENS, rng);
    const numberByHex = new Map();
    targets.forEach((hexId, i) => numberByHex.set(hexId, tokens[i]));
    if (isValidRedPlacement(numberByHex, hexes)) {
      return { numberByHex, attempts: attempt };
    }
  }

  // Fallback (extremely unlikely to be reached): repair by swapping any red
  // token that conflicts with a random non-red hex until valid.
  const tokens = shuffle(NUMBER_TOKENS, rng);
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
