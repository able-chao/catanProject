// ---------------------------------------------------------------------------
// Map registry. A map defines everything that varies between board layouts:
//   coords       — which axial (q, r) cells are land
//   tileCounts   — the terrain bag (must sum to coords.length)
//   tokenNumbers — the number-token pool (one per PRODUCING tile)
//
// The generator (board.js) is map-agnostic: geometry, vertex/edge dedupe,
// token placement (6/8 rule) and port placement all work on any shape.
// The host picks the map in the lobby; it is locked once the game starts.
// ---------------------------------------------------------------------------

import { hex, hexSpiral } from '../utils/hex.js';

/** Axial parallelogram: qCount columns × rCount rows (a leaning diamond). */
function parallelogram(qCount, rCount, qOffset, rOffset) {
  const coords = [];
  for (let q = 0; q < qCount; q++) {
    for (let r = 0; r < rCount; r++) {
      coords.push(hex(q + qOffset, r + rOffset));
    }
  }
  return coords;
}

export const MAPS = {
  classic: {
    id: 'classic',
    name: 'Classic',
    tagline: '19 hexes · 9 ports · 1 desert',
    coords: hexSpiral(hex(0, 0), 2),
    tileCounts: { forest: 4, pasture: 4, fields: 4, mountains: 3, hills: 3, desert: 1 },
    // The canonical A–R token pool: one 2 & 12, two each of 3–6 and 8–11.
    tokenNumbers: [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11],
  },

  diamond: {
    id: 'diamond',
    name: 'Diamond',
    tagline: '24 hexes · 9 ports · 1 lake',
    // A 6 × 4 leaning rhombus, roughly centred on the origin.
    coords: parallelogram(6, 4, -3, -1),
    tileCounts: { forest: 5, pasture: 5, fields: 5, mountains: 4, hills: 4, lake: 1 },
    // 23 producing tiles. Scaled-up classic distribution; still four reds
    // (two 6s, two 8s) so the non-adjacency rule stays meaningful.
    tokenNumbers: [2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 12],
  },
};

export const DEFAULT_MAP = 'classic';

export const MAP_LIST = Object.values(MAPS);

export function getMap(mapId) {
  return MAPS[mapId] ?? MAPS[DEFAULT_MAP];
}
