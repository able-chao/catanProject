// Targeted tests for Phase 5 features: bank/port trade, dev cards, player
// trades, Largest Army. Crafts game states on a real board and asserts effects
// plus resource conservation (bank + all hands == 19 per resource).
//   node scripts/phase5.test.mjs
import { generateBoard } from '../src/board/board.js';
import { createInitialGame, RESOURCE_KEYS } from '../src/engine/setup.js';
import { gameReducer } from '../src/engine/reducer.js';
import { ACTIONS } from '../src/engine/actions.js';
import { PHASES } from '../src/engine/phases.js';
import { tradeRates } from '../src/engine/trade.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ ${name}`); } };

function conserved(game) {
  return RESOURCE_KEYS.every((r) => game.bank[r] + game.players.reduce((s, p) => s + p.resources[r], 0) === 19);
}

// A fresh board + game with current player in TRADE phase and empty hands.
function base() {
  const board = generateBoard();
  let game = createInitialGame(board, 4);
  game = { ...game, phase: PHASES.MAIN, turn: 1, currentPlayer: 0 };
  return { board, game };
}
const give = (game, pid, res) => ({
  ...game,
  players: game.players.map((p) => (p.id === pid ? { ...p, resources: { ...p.resources, ...res } } : p)),
  bank: RESOURCE_KEYS.reduce((b, r) => ({ ...b, [r]: b[r] - (res[r] ?? 0) }), { ...game.bank }),
});

// --- Bank 4:1 trade ---
{
  const { board, game } = base();
  let g = give(game, 0, { lumber: 4 });
  g = gameReducer(g, { type: ACTIONS.BANK_TRADE, give: 'lumber', get: 'ore' }, board);
  ok('bank 4:1 deducts 4 lumber', g.players[0].resources.lumber === 0);
  ok('bank 4:1 grants 1 ore', g.players[0].resources.ore === 1);
  ok('bank 4:1 conserves', conserved(g));
}

// --- Port rate unlocked by a building ---
{
  const { board, game } = base();
  const specific = [...board.ports.values()].find((p) => p.yields);
  let g = { ...game, buildings: { [specific.vertexIds[0]]: { type: 'settlement', player: 0 } } };
  ok('2:1 specific port rate', tradeRates(g, board, 0)[specific.yields] === 2);
  ok('non-port resource still 4', Object.values(tradeRates({ ...game, buildings: {} }, board, 0)).every((r) => r === 4));
}

// --- Buy dev card (deck stacked), can't play same turn ---
{
  const { board, game } = base();
  let g = give(game, 0, { ore: 1, wool: 1, grain: 1 });
  g = { ...g, devDeck: ['knight'] };
  g = gameReducer(g, { type: ACTIONS.BUY_DEV }, board);
  ok('buy dev: knight in hand', g.players[0].dev.knight === 1);
  ok('buy dev: deck empty', g.devDeck.length === 0);
  ok('buy dev: cost paid', g.players[0].resources.ore === 0 && conserved(g));
  const g2 = gameReducer(g, { type: ACTIONS.PLAY_KNIGHT }, board);
  ok("can't play knight bought this turn", g2 === g);
}

// --- Year of Plenty ---
{
  const { board, game } = base();
  let g = { ...game, players: game.players.map((p) => (p.id === 0 ? { ...p, dev: { ...p.dev, yearOfPlenty: 1 } } : p)) };
  g = gameReducer(g, { type: ACTIONS.PLAY_YEAR_OF_PLENTY }, board);
  ok('YoP sets pending', g.pendingYearOfPlenty === true);
  g = gameReducer(g, { type: ACTIONS.PICK_YEAR_OF_PLENTY, resources: ['ore', 'brick'] }, board);
  ok('YoP grants 2 cards', g.players[0].resources.ore === 1 && g.players[0].resources.brick === 1);
  ok('YoP conserves', conserved(g) && g.pendingYearOfPlenty === false);
}

// --- Monopoly ---
{
  const { board, game } = base();
  let g = give(give(give(game, 1, { wool: 3 }), 2, { wool: 2 }), 3, { wool: 1 });
  g = { ...g, players: g.players.map((p) => (p.id === 0 ? { ...p, dev: { ...p.dev, monopoly: 1 } } : p)) };
  g = gameReducer(g, { type: ACTIONS.PLAY_MONOPOLY }, board);
  g = gameReducer(g, { type: ACTIONS.PICK_MONOPOLY, resource: 'wool' }, board);
  ok('monopoly collects all wool', g.players[0].resources.wool === 6);
  ok('monopoly empties others', [1, 2, 3].every((i) => g.players[i].resources.wool === 0));
  ok('monopoly conserves', conserved(g));
}

// --- Player-to-player trade ---
{
  const { board, game } = base();
  let g = give(give(game, 0, { lumber: 2 }), 1, { ore: 1 });
  g = gameReducer(g, { type: ACTIONS.PROPOSE_TRADE, from: 0, to: null, give: { lumber: 2 }, want: { ore: 1 } }, board);
  ok('offer is pending', g.pendingTrade && g.pendingTrade.from === 0);
  g = gameReducer(g, { type: ACTIONS.ACCEPT_TRADE, playerId: 1 }, board);
  ok('trade executed (giver)', g.players[0].resources.lumber === 0 && g.players[0].resources.ore === 1);
  ok('trade executed (taker)', g.players[1].resources.ore === 0 && g.players[1].resources.lumber === 2);
  ok('trade conserves', conserved(g) && g.pendingTrade === null);
}

// --- Largest Army ---
{
  const { board, game } = base();
  // Player 0 already played 2 knights; holds a third (not bought this turn).
  let g = { ...game, players: game.players.map((p) => (p.id === 0 ? { ...p, knightsPlayed: 2, dev: { ...p.dev, knight: 1 } } : p)) };
  g = gameReducer(g, { type: ACTIONS.PLAY_KNIGHT }, board);
  ok('3rd knight -> Largest Army', g.largestArmy === 0 && g.players[0].knightsPlayed === 3);
  ok('knight enters MOVE_ROBBER', g.phase === PHASES.MOVE_ROBBER);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
