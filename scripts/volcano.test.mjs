// Volcano map features: fog generation, road-reveal, fog production/robber/
// settlement rules, and the gold field's choose-your-resource payout.
//   node scripts/volcano.test.mjs
import { generateBoard } from '../src/board/board.js';
import { getMap } from '../src/board/maps.js';
import { createInitialGame, RESOURCE_KEYS } from '../src/engine/setup.js';
import { computeValidPlacements } from '../src/engine/building.js';
import { gameReducer } from '../src/engine/reducer.js';
import { ACTIONS } from '../src/engine/actions.js';
import { PHASES } from '../src/engine/phases.js';
import { distribute } from '../src/engine/distribution.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };
const conserved = (g) => RESOURCE_KEYS.every((r) => g.bank[r] + g.players.reduce((s, p) => s + p.resources[r], 0) === 19);
const diceFor = (total) => { const d1 = Math.max(1, total - 6); return [d1, total - d1]; };

const map = getMap('volcano');
const board = generateBoard({ mapId: 'volcano', seed: 12345 });
const hexes = [...board.hexes.values()];

// --- Board generation --------------------------------------------------------
ok('75 hexes', hexes.length === 75);
ok('18 fog hexes', hexes.filter((h) => h.fog).length === map.fogCoords.length && map.fogCoords.length === 18);
const golds = hexes.filter((h) => h.resource === 'gold');
ok('exactly one gold field, revealed, with a token', golds.length === 1 && !golds[0].fog && golds[0].token);
ok('no desert hides under fog', !hexes.some((h) => h.fog && h.yields == null));
ok('72 tokens placed', hexes.filter((h) => h.token).length === 72);

// --- Initial game state ------------------------------------------------------
let game = createInitialGame(board, 4);
game = { ...game, valid: computeValidPlacements(game, board) };
ok('fog seeded into game state', Object.keys(game.fog).length === 18);
ok('robber starts on a revealed desert', !game.fog[game.robberHex] && board.hexes.get(game.robberHex).yields == null);

// --- Settlement rule: not in fully-fogged territory --------------------------
const allFogVertex = [...board.vertices.values()].find((v) => v.hexIds.every((h) => game.fog[h]));
const boundaryVertex = [...board.vertices.values()].find(
  (v) => v.hexIds.some((h) => game.fog[h]) && v.hexIds.some((h) => !game.fog[h]),
);
ok('a fully-fogged vertex exists on this map', Boolean(allFogVertex));
ok('cannot settle where every hex is fog', !game.valid.settlements.includes(allFogVertex.id));
ok('CAN settle on the fog boundary', game.valid.settlements.includes(boundaryVertex.id));

// --- Road reveal -------------------------------------------------------------
// Setup: settle on the boundary vertex, then run the setup road along an edge
// that touches a fog hex — that hex must be revealed.
let g = gameReducer(game, { type: ACTIONS.PLACE_SETTLEMENT, vertexId: boundaryVertex.id }, board);
const fogEdge = boundaryVertex.edgeIds
  .map((eid) => board.edges.get(eid))
  .find((e) => e.hexIds.some((h) => g.fog[h]));
const revealTargets = fogEdge.hexIds.filter((h) => g.fog[h]);
g = gameReducer(g, { type: ACTIONS.PLACE_ROAD, edgeId: fogEdge.id }, board);
ok('road touching fog reveals it', revealTargets.every((h) => !g.fog[h]));
ok('reveal is logged', g.log.some((e) => e.text.includes('explored')));
ok('other fog untouched', Object.keys(g.fog).length === 18 - revealTargets.length);

// --- Fogged hexes do not produce ----------------------------------------------
// Find a fogged hex with a token; put a settlement on one of its vertices.
const fogHex = hexes.find((h) => game.fog[h.id] && h.token);
const fv = fogHex.vertexIds[0];
const prodState = {
  ...game,
  buildings: { [fv]: { type: 'settlement', player: 0 } },
};
const res = fogHex.yields;
const withFog = distribute(prodState, board, fogHex.token.number).gains[0]?.[res] ?? 0;
const noFog = distribute({ ...prodState, fog: {} }, board, fogHex.token.number).gains[0]?.[res] ?? 0;
ok('fogged tile yields nothing (reveal adds it)', noFog === withFog + 1);

// --- Robber cannot enter fog ---------------------------------------------------
const robberState = { ...game, phase: PHASES.MOVE_ROBBER };
const fogTarget = Object.keys(game.fog)[0];
ok('robber move into fog rejected', gameReducer(robberState, { type: ACTIONS.MOVE_ROBBER, hexId: fogTarget }, board) === robberState);
const openTarget = hexes.find((h) => !game.fog[h.id] && h.id !== game.robberHex);
ok('robber move to open land works', gameReducer(robberState, { type: ACTIONS.MOVE_ROBBER, hexId: openTarget.id }, board).robberHex === openTarget.id);

// --- Gold field: choose-your-resource payout -----------------------------------
const goldHex = golds[0];
const gv = goldHex.vertexIds[0];
let gg = {
  ...game,
  phase: PHASES.ROLL,
  turn: 1,
  currentPlayer: 0,
  buildings: { [gv]: { type: 'settlement', player: 0 } },
};
gg = gameReducer(gg, { type: ACTIONS.ROLL_DICE, dice: diceFor(goldHex.token.number) }, board);
ok('gold roll queues a pick', gg.pendingGold?.length === 1 && gg.pendingGold[0].player === 0 && gg.pendingGold[0].count === 1);
ok('end turn blocked while gold pending', gameReducer(gg, { type: ACTIONS.END_TURN }, board) === gg);
ok('placements blocked while gold pending', gg.valid.roads.length === 0 && gg.valid.settlements.length === 0);
const wrongCount = gameReducer(gg, { type: ACTIONS.PICK_GOLD, resources: ['ore', 'brick'] }, board);
ok('wrong pick count rejected', wrongCount === gg);
const oreBefore = gg.players[0].resources.ore;
let done = gameReducer(gg, { type: ACTIONS.PICK_GOLD, resources: ['ore'] }, board);
ok('gold pick grants the chosen resource', done.players[0].resources.ore === oreBefore + 1);
ok('gold queue cleared + conserved', done.pendingGold === null && conserved(done));
ok('end turn works after the pick', gameReducer(done, { type: ACTIONS.END_TURN }, board).phase === PHASES.ROLL);

// A city adjacent to gold owes TWO picks.
let gc = {
  ...game,
  phase: PHASES.ROLL,
  turn: 1,
  currentPlayer: 1,
  buildings: { [gv]: { type: 'city', player: 1 } },
};
gc = gameReducer(gc, { type: ACTIONS.ROLL_DICE, dice: diceFor(goldHex.token.number) }, board);
ok('city on gold owes 2 picks', gc.pendingGold?.[0]?.count === 2);
gc = gameReducer(gc, { type: ACTIONS.PICK_GOLD, resources: ['grain', 'wool'] }, board);
ok('city pick grants both + conserved', gc.players[1].resources.grain >= 1 && gc.players[1].resources.wool >= 1 && conserved(gc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
