// ---------------------------------------------------------------------------
// Resource tiles: the pool, their metadata, and the Fisher-Yates assignment to
// hex positions (in spiral order). Phase 2 outline counts:
//   4 forest, 4 pasture, 4 fields, 3 mountains, 3 hills, 1 desert  (= 19)
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

// Terrain -> { the resource it yields, display info, fill colour }.
export const RESOURCES = {
  forest: { id: 'forest', yields: 'lumber', label: 'Forest', resource: 'Wood', color: '#3f7a34' },
  pasture: { id: 'pasture', yields: 'wool', label: 'Pasture', resource: 'Sheep', color: '#8fbf57' },
  fields: { id: 'fields', yields: 'grain', label: 'Fields', resource: 'Wheat', color: '#e6b422' },
  mountains: { id: 'mountains', yields: 'ore', label: 'Mountains', resource: 'Ore', color: '#9aa3ad' },
  hills: { id: 'hills', yields: 'brick', label: 'Hills', resource: 'Brick', color: '#c45a3b' },
  desert: { id: 'desert', yields: null, label: 'Desert', resource: '—', color: '#d8c89a' },
};

// How many of each terrain go in the bag.
export const TILE_COUNTS = {
  forest: 4,
  pasture: 4,
  fields: 4,
  mountains: 3,
  hills: 3,
  desert: 1,
};

/** The 19-tile pool as a flat array of terrain ids, ready to shuffle. */
export function buildTilePool() {
  const pool = [];
  for (const [terrain, count] of Object.entries(TILE_COUNTS)) {
    for (let i = 0; i < count; i++) pool.push(terrain);
  }
  return pool;
}

/**
 * Shuffle the tile pool and assign one terrain to each hex, walking the hexes
 * in spiral order.
 * @returns {Map<hexId, terrainId>}
 */
export function assignTiles(hexOrder, rng) {
  const pool = shuffle(buildTilePool(), rng);
  const byHex = new Map();
  hexOrder.forEach((hexId, i) => byHex.set(hexId, pool[i]));
  return byHex;
}
