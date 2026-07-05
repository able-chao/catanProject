// ---------------------------------------------------------------------------
// Map registry. A map defines everything that varies between board layouts:
//   coords       — which axial (q, r) cells are land
//   tileCounts   — the terrain bag (must sum to coords.length)
//   tokenNumbers — the number-token pool (one per PRODUCING tile)
//   portCounts   — how many ports of each kind ring the coast
//
// The generator (board.js) is map-agnostic: geometry, vertex/edge dedupe,
// token placement (6/8 rule) and port placement all work on any shape.
// The host picks the map in the lobby; it is locked once the game starts.
// ---------------------------------------------------------------------------

import { hex, hexSpiral, hexRing } from '../utils/hex.js';

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

/**
 * Hand-authored shapes on an odd-q offset grid (flat-top; odd columns sit half
 * a hex lower), converted to axial and roughly centred. Characters:
 *   '#' — ordinary hex        'F' — hex that starts hidden under fog
 *   'G' — the gold field (visible from the start; produces any resource)
 */
function parseAscii(art) {
  const coords = [];
  const fogCoords = [];
  const goldCoords = [];
  const width = Math.max(...art.map((l) => l.length));
  const qShift = Math.floor(width / 2);
  const rowShift = Math.floor(art.length / 2);
  art.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      if (ch === ' ') return;
      const q = col - qShift;
      const h = hex(q, row - rowShift - Math.floor(q / 2));
      coords.push(h);
      if (ch === 'F') fogCoords.push(h);
      if (ch === 'G') goldCoords.push(h);
    });
  });
  return { coords, fogCoords, goldCoords };
}

/** { 3: 2, 8: 1 } -> [3, 3, 8] */
function expandCounts(counts) {
  return Object.entries(counts).flatMap(([n, c]) => Array(c).fill(Number(n)));
}

// The continental United States as 144 hexes: Maine's north-east tail, the
// East Coast slanting down to Florida, the Gulf notch, Texas, and the West
// Coast. Verified connected; exactly 144 cells.
const USA_SHAPE = [
  ' ###########          # ',
  ' ############       ### ',
  '###############    #### ',
  '###################### ',
  ' #################### ',
  ' ###################  ',
  '  ################    ',
  '   #######  ####      ',
  '    #####      ##     ',
  '     ##         #     ',
];

// Earth: the world as 7 separate islands — Asia (20), North America (18),
// Africa (14), Europe (10), South America (10), Australia (6), Greenland (3).
// 81 hexes total; roads can't cross water, so each island is its own theatre.
// Verified exactly 7 connected components.
const EARTH_SHAPE = [
  ' ####  ##   ###   ####### ',
  '######  #  #####  ########',
  '#####       ##     #####  ',
  ' ###                      ',
  '            ####          ',
  '   ###      ####          ',
  '   ####     ####     ##   ',
  '    ##       ##      ###  ',
  '    #                 #   ',
];

// Volcano: a fog "X" hides the middle of the island; only the gold field at
// its heart is visible. Roads that touch a fog hex reveal it.
// 75 hexes = 56 open + 18 fog + 1 gold. Verified connected.
const VOLCANO_SHAPE = [
  '  #########  ',
  ' ###FF#FF### ',
  ' ####FFF#### ',
  '####FFGFF####',
  ' ####FFF#### ',
  ' ###FF#FF### ',
  '  #########  ',
];

// Black Forest: a gold isle in a lake, ringed by two circles of deep forest —
// and everything beyond the treeline hidden in fog. Ring 1 is missing
// entirely (the moat), so the isle is only reachable during setup.
// 55 hexes = centre + rings 2, 3 (fixed forest) + ring 4 (the fog frontier).
const BLACK_FOREST = (() => {
  const center = hex(0, 0);
  const ring2 = hexRing(center, 2);
  const ring3 = hexRing(center, 3);
  const ring4 = hexRing(center, 4);
  return {
    coords: [center, ...ring2, ...ring3, ...ring4],
    goldCoords: [center],
    forestCoords: [...ring2, ...ring3],
    fogCoords: ring4,
  };
})();

export const MAPS = {
  classic: {
    id: 'classic',
    name: 'Classic',
    tagline: '19 hexes · 9 ports · 1 desert',
    coords: hexSpiral(hex(0, 0), 2),
    tileCounts: { forest: 4, pasture: 4, fields: 4, mountains: 3, hills: 3, desert: 1 },
    // The canonical A–R token pool: one 2 & 12, two each of 3–6 and 8–11.
    tokenNumbers: [5, 2, 6, 3, 8, 10, 9, 12, 11, 4, 8, 10, 9, 4, 5, 6, 3, 11],
    portCounts: { generic: 5, ore: 1, wheat: 1, wood: 1, sheep: 1 },
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
    portCounts: { generic: 5, ore: 1, wheat: 1, wood: 1, sheep: 1 },
  },

  usa: {
    id: 'usa',
    name: 'USA',
    tagline: '144 hexes · 25 ports',
    coords: parseAscii(USA_SHAPE).coords,
    // 138 producing tiles + 6 deserts = 144.
    tileCounts: { forest: 30, pasture: 30, fields: 30, mountains: 24, hills: 24, desert: 6 },
    // 138 tokens at the classic proportions; 24 reds (twelve 6s, twelve 8s)
    // still may never touch — placement leans on the constraint solver.
    tokenNumbers: expandCounts({ 2: 8, 3: 16, 4: 16, 5: 17, 6: 12, 8: 12, 9: 17, 10: 16, 11: 16, 12: 8 }),
    portCounts: { generic: 10, ore: 3, wheat: 3, wood: 3, sheep: 3, brick: 3 },
  },

  earth: {
    id: 'earth',
    name: 'Earth',
    tagline: '81 hexes · 27 ports · 7 islands',
    coords: parseAscii(EARTH_SHAPE).coords,
    // 77 producing tiles + 4 deserts = 81.
    tileCounts: { forest: 17, pasture: 17, fields: 17, mountains: 13, hills: 13, desert: 4 },
    tokenNumbers: expandCounts({ 2: 4, 3: 9, 4: 9, 5: 9, 6: 8, 8: 8, 9: 9, 10: 9, 11: 8, 12: 4 }),
    portCounts: { generic: 12, ore: 3, wheat: 3, wood: 3, sheep: 3, brick: 3 },
  },

  blackforest: {
    id: 'blackforest',
    name: 'Black Forest',
    tagline: '55 hexes · gold isle · fog frontier',
    coords: BLACK_FOREST.coords,
    goldCoords: BLACK_FOREST.goldCoords,
    forestCoords: BLACK_FOREST.forestCoords,
    fogCoords: BLACK_FOREST.fogCoords,
    // The bag covers ONLY the 24 fog tiles — the visible world is fixed
    // terrain (30 forest + the gold isle). The lone desert always gets swapped
    // out of the fog into the forest ring, giving the robber a start and the
    // woods a clearing.
    tileCounts: { pasture: 6, fields: 6, mountains: 5, hills: 6, desert: 1 },
    // 54 producing tiles = 1 gold + 30 forest + 23 fog. Classic ratios ×3.
    tokenNumbers: expandCounts({ 2: 3, 3: 6, 4: 6, 5: 6, 6: 6, 8: 6, 9: 6, 10: 6, 11: 6, 12: 3 }),
    portCounts: { generic: 4, ore: 1, wheat: 1, wood: 1, sheep: 1, brick: 1 },
    portZone: 'inner', // ports ring the central lagoon, like the reference
  },

  volcano: {
    id: 'volcano',
    name: 'Volcano',
    tagline: '75 hexes · fog & a gold field',
    ...(() => {
      const { coords, fogCoords, goldCoords } = parseAscii(VOLCANO_SHAPE);
      return { coords, fogCoords, goldCoords };
    })(),
    // The bag covers every hex EXCEPT the fixed gold field: 56 + 18 = 74.
    tileCounts: { forest: 15, pasture: 15, fields: 15, mountains: 13, hills: 13, desert: 3 },
    // 71 producing bag tiles + the gold field = 72 tokens (classic ratios ×4).
    tokenNumbers: expandCounts({ 2: 4, 3: 8, 4: 8, 5: 8, 6: 8, 8: 8, 9: 8, 10: 8, 11: 8, 12: 4 }),
    portCounts: { generic: 6, ore: 1, wheat: 1, wood: 1, sheep: 1, brick: 1 },
  },
};

export const DEFAULT_MAP = 'classic';

export const MAP_LIST = Object.values(MAPS);

export function getMap(mapId) {
  return MAPS[mapId] ?? MAPS[DEFAULT_MAP];
}

/** Total ports a map expects (used by validation). */
export function portTotal(map) {
  return Object.values(map.portCounts).reduce((s, n) => s + n, 0);
}
