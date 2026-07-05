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
 *
 * Small maps almost always succeed by rejection sampling within a few tries;
 * dense maps (e.g. USA: 24 reds among 138 tiles) essentially never do, so
 * after `maxAttempts` we repair the last shuffle instead — each repair swap
 * strictly reduces the conflict count, so it always terminates valid.
 * @returns {{ numberByHex: Map<hexId, token>, attempts: number }}
 */
export function placeTokens(hexOrder, hexes, rng, tokenNumbers, maxAttempts = 80) {
  const targets = hexOrder.filter((id) => hexes.get(id).yields != null);
  const pool = buildTokens(tokenNumbers);

  const deal = () => {
    const tokens = shuffle(pool, rng);
    const numberByHex = new Map();
    targets.forEach((hexId, i) => numberByHex.set(hexId, tokens[i]));
    return numberByHex;
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const numberByHex = deal();
    if (isValidRedPlacement(numberByHex, hexes)) {
      return { numberByHex, attempts: attempt };
    }
  }

  // Repair fresh shuffles until one converges. A single repair pass can (very
  // rarely, on red-dense maps) strand itself with no safe cell to move a red
  // into — a new shuffle re-rolls the layout, so a handful of rounds always
  // lands a valid board.
  let numberByHex = deal();
  for (let round = 0; round < 100; round++) {
    repairRedAdjacency(numberByHex, hexes, targets, rng);
    if (isValidRedPlacement(numberByHex, hexes)) {
      return { numberByHex, attempts: maxAttempts + round + 1 };
    }
    numberByHex = deal();
  }
  return { numberByHex, attempts: maxAttempts + 100 }; // effectively unreachable
}

/**
 * Move each conflicting red token to a random SAFE cell — a non-red cell with
 * no red neighbours (which also rules out cells next to the conflict itself).
 * A swap therefore never creates a new adjacency and always removes at least
 * one, so conflicts strictly decrease until none remain.
 */
function repairRedAdjacency(numberByHex, hexes, targets, rng, maxSwaps = 500) {
  for (let i = 0; i < maxSwaps; i++) {
    if (isValidRedPlacement(numberByHex, hexes)) return;
    const conflict = targets.find((id) => {
      const t = numberByHex.get(id);
      return (
        t.red &&
        hexes.get(id).neighborIds.some((n) => numberByHex.get(n)?.red)
      );
    });
    if (!conflict) return;
    const safe = targets.filter((id) => {
      if (numberByHex.get(id).red) return false;
      return !hexes.get(id).neighborIds.some((n) => numberByHex.get(n)?.red);
    });
    if (!safe.length) return; // no safe cell left — give up (never at our densities)
    const swapWith = safe[Math.floor(rng() * safe.length)];
    const tmp = numberByHex.get(conflict);
    numberByHex.set(conflict, numberByHex.get(swapWith));
    numberByHex.set(swapWith, tmp);
  }
}
