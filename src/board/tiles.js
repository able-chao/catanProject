// ---------------------------------------------------------------------------
// Resource tiles: terrain metadata and the Fisher-Yates assignment of a map's
// tile bag to hex positions. The bag comes from the map definition (maps.js) —
// classic uses 4/4/4/3/3 + 1 desert; other maps swap counts or add terrains
// like the lake.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

// Terrain -> { the resource it yields, display info, fill colour }.
// `yields: null` terrains (desert, lake) produce nothing; the robber starts on
// one of them.
export const RESOURCES = {
  forest: { id: 'forest', yields: 'lumber', label: 'Forest', resource: 'Wood', color: '#3f7a34' },
  pasture: { id: 'pasture', yields: 'wool', label: 'Pasture', resource: 'Sheep', color: '#8fbf57' },
  fields: { id: 'fields', yields: 'grain', label: 'Fields', resource: 'Wheat', color: '#e6b422' },
  mountains: { id: 'mountains', yields: 'ore', label: 'Mountains', resource: 'Ore', color: '#9aa3ad' },
  hills: { id: 'hills', yields: 'brick', label: 'Hills', resource: 'Brick', color: '#c45a3b' },
  desert: { id: 'desert', yields: null, label: 'Desert', resource: '—', color: '#d8c89a' },
  lake: { id: 'lake', yields: null, label: 'Lake', resource: '—', color: '#4a8fc0' },
};

/** A map's tile bag as a flat array of terrain ids, ready to shuffle. */
export function buildTilePool(tileCounts) {
  const pool = [];
  for (const [terrain, count] of Object.entries(tileCounts)) {
    for (let i = 0; i < count; i++) pool.push(terrain);
  }
  return pool;
}

/**
 * Shuffle the map's tile bag and assign one terrain to each hex, walking the
 * hexes in board order.
 * @returns {Map<hexId, terrainId>}
 */
export function assignTiles(hexOrder, rng, tileCounts) {
  const pool = shuffle(buildTilePool(tileCounts), rng);
  const byHex = new Map();
  hexOrder.forEach((hexId, i) => byHex.set(hexId, pool[i]));
  return byHex;
}
