// Black Forest map: moat geometry, fixed forest rings, the desert clearing,
// inner-lagoon ports, and the settle-able gold isle.
//   node scripts/blackforest.test.mjs
import { generateBoard } from '../src/board/board.js';
import { createInitialGame } from '../src/engine/setup.js';
import { computeValidPlacements } from '../src/engine/building.js';
import { hex, hexId, hexRing, hexDistance } from '../src/utils/hex.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };

const CENTER = hex(0, 0);
const board = generateBoard({ mapId: 'blackforest', seed: 4242 });
const hexes = [...board.hexes.values()];
const dist = (h) => hexDistance(h, CENTER);

// --- Geometry: the moat -------------------------------------------------------
ok('55 hexes', hexes.length === 55);
ok('ring 1 is water (missing)', hexRing(CENTER, 1).every((c) => !board.hexes.has(hexId(c))));
ok('rings 0,2,3,4 all present', hexes.every((h) => dist(h) !== 1));

// --- Fixed terrain -------------------------------------------------------------
const centerTile = board.hexes.get(hexId(CENTER));
ok('centre is a revealed gold field with a token', centerTile.resource === 'gold' && !centerTile.fog && centerTile.token);
const revealed = hexes.filter((h) => !h.fog && h.id !== centerTile.id);
ok('revealed world is rings 2-3', revealed.length === 30 && revealed.every((h) => dist(h) <= 3));
const clearing = revealed.filter((h) => h.resource === 'desert');
ok('exactly one desert clearing in the woods', clearing.length === 1);
ok('every other revealed tile is forest', revealed.filter((h) => h.resource === 'forest').length === 29);
ok('fog frontier is all of ring 4', hexes.filter((h) => h.fog).length === 24 && hexes.filter((h) => h.fog).every((h) => dist(h) === 4));
ok('no desert hides in the fog', !hexes.some((h) => h.fog && h.yields == null));
ok('54 tokens placed', hexes.filter((h) => h.token).length === 54);

// --- Ports ring the lagoon -------------------------------------------------------
const ports = [...board.ports.values()];
ok('9 ports placed', ports.length === 9);
ok(
  'every port sits on the inner coast (owner within ring 2)',
  ports.every((p) => dist(board.hexes.get(board.edges.get(p.edgeId).hexIds[0])) <= 2),
);

// --- The gold isle --------------------------------------------------------------
const game = (() => {
  const g = createInitialGame(board, 4);
  return { ...g, valid: computeValidPlacements(g, board) };
})();
ok('robber starts on the desert clearing', board.hexes.get(game.robberHex).resource === 'desert' && !game.fog[game.robberHex]);
const isleVertices = centerTile.vertexIds;
ok('gold isle vertices belong only to the isle', isleVertices.every((vid) => board.vertices.get(vid).hexIds.length === 1));
ok('gold isle is settleable during setup', isleVertices.some((vid) => game.valid.settlements.includes(vid)));
ok('no edges cross the moat', isleVertices.every((vid) => board.vertices.get(vid).edgeIds.every((eid) => board.edges.get(eid).hexIds.length === 1 && board.edges.get(eid).hexIds[0] === centerTile.id)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
