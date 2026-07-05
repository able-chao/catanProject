// Friendly robber option: hexes adjacent to players under 3 VP are off-limits
// to the robber — with a safety valve when that would block every hex.
//   node scripts/friendly-robber.test.mjs
import { generateBoard } from '../src/board/board.js';
import { createInitialGame } from '../src/engine/setup.js';
import { gameReducer } from '../src/engine/reducer.js';
import { ACTIONS } from '../src/engine/actions.js';
import { PHASES } from '../src/engine/phases.js';
import { validRobberHexes } from '../src/engine/rules.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };

const board = generateBoard({ mapId: 'classic', seed: 777 });
const hexes = [...board.hexes.values()];

// A producing hex away from the robber start, with a free neighbour hex.
const targetHex = hexes.find((h) => h.yields && h.id !== createInitialGame(board, 4).robberHex);
const emptyHex = hexes.find((h) => h.id !== targetHex.id && !targetHex.vertexIds.some((v) => board.hexes.get(h.id).vertexIds.includes(v)));

function gameWith({ friendly, vp }) {
  let g = createInitialGame(board, 4, { friendlyRobber: friendly });
  // Player 1 owns a settlement on the target hex and has `vp` points.
  g = {
    ...g,
    phase: PHASES.MOVE_ROBBER,
    currentPlayer: 0,
    buildings: { [targetHex.vertexIds[0]]: { type: 'settlement', player: 1 } },
    players: g.players.map((p) => (p.id === 1 ? { ...p, victoryPoints: vp } : p)),
  };
  return g;
}

// --- Option off: anything goes -------------------------------------------------
{
  const g = gameWith({ friendly: false, vp: 2 });
  ok('option off: robbing a 2-VP player allowed', gameReducer(g, { type: ACTIONS.MOVE_ROBBER, hexId: targetHex.id }, board).robberHex === targetHex.id);
}

// --- Option on: under 3 VP protects --------------------------------------------
{
  const g = gameWith({ friendly: true, vp: 2 });
  ok('under 3 VP: hex excluded from valid targets', !validRobberHexes(g, board).includes(targetHex.id));
  ok('under 3 VP: move onto their hex rejected', gameReducer(g, { type: ACTIONS.MOVE_ROBBER, hexId: targetHex.id }, board) === g);
  ok('empty hex still allowed', gameReducer(g, { type: ACTIONS.MOVE_ROBBER, hexId: emptyHex.id }, board).robberHex === emptyHex.id);
}

// --- Option on: 3+ VP lifts protection ------------------------------------------
{
  const g = gameWith({ friendly: true, vp: 3 });
  ok('at 3 VP: hex becomes a valid target', validRobberHexes(g, board).includes(targetHex.id));
  ok('at 3 VP: robber may move there', gameReducer(g, { type: ACTIONS.MOVE_ROBBER, hexId: targetHex.id }, board).robberHex === targetHex.id);
}

// --- Safety valve: everyone protected everywhere -> rule relaxes -----------------
{
  let g = createInitialGame(board, 4, { friendlyRobber: true });
  // A 2-VP player owns a corner of EVERY hex.
  const buildings = {};
  for (const h of hexes) buildings[h.vertexIds[0]] = { type: 'settlement', player: 1 };
  g = { ...g, phase: PHASES.MOVE_ROBBER, currentPlayer: 0, buildings };
  const legal = validRobberHexes(g, board);
  ok('all-protected board falls back to all hexes', legal.length === hexes.length - 1);
  ok('robber can still move somewhere', gameReducer(g, { type: ACTIONS.MOVE_ROBBER, hexId: legal[0] }, board).robberHex === legal[0]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
