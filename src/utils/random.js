// ---------------------------------------------------------------------------
// Randomness helpers. A seedable RNG (mulberry32) means an entire board can be
// reproduced from a single integer seed — handy for testing the 6/8 rule and,
// later, for syncing the same board to every player in multiplayer.
// ---------------------------------------------------------------------------

/** Tiny, fast, seedable PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random 32-bit seed. */
export function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}

/** Fisher-Yates shuffle. Returns a NEW array; does not mutate the input. */
export function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
