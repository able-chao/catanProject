// Headless engine simulation: play many full games via the pure reducer and
// assert invariants after every action.
//   node scripts/engine-sim.mjs [games] [turnsPerGame]
import { generateBoard } from '../src/board/board.js';
import { createInitialGame, RESOURCE_KEYS, handTotal } from '../src/engine/setup.js';
import { gameReducer } from '../src/engine/reducer.js';
import { ACTIONS } from '../src/engine/actions.js';
import { PHASES, isSetupPhase } from '../src/engine/phases.js';
import { validSettlementSpots, validRoadSpots } from '../src/engine/rules.js';
import { SUPPLY_LIMITS } from '../src/engine/building.js';

const GAMES = Number(process.argv[2] ?? 300);
const TURNS = Number(process.argv[3] ?? 60);
const d6 = () => 1 + Math.floor(Math.random() * 6);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

let failures = 0;
let sevens = 0;
let discards = 0;
let steals = 0;
let builds = 0;
let wins = 0;

function fail(msg, game) {
  failures++;
  console.error('INVARIANT FAILED:', msg, '| seed', game.seed, '| turn', game.turn, '| phase', game.phase);
}

function checkInvariants(game, board, label) {
  // 1. Resource conservation: bank + all hands == 19 per resource.
  for (const r of RESOURCE_KEYS) {
    let total = game.bank[r];
    for (const p of game.players) total += p.resources[r];
    if (total !== 19) fail(`conservation ${r}=${total} after ${label}`, game);
    if (game.bank[r] < 0) fail(`negative bank ${r} after ${label}`, game);
  }
  // 2. No negative hands.
  for (const p of game.players) {
    for (const r of RESOURCE_KEYS) if (p.resources[r] < 0) fail(`negative hand ${p.name}.${r}`, game);
  }
  // 3. Distance rule: no two settlements adjacent.
  for (const vid of Object.keys(game.buildings)) {
    const v = board.vertices.get(vid);
    if (v.adjacentVertexIds.some((a) => game.buildings[a])) fail(`adjacent buildings at ${vid}`, game);
  }
  // 4. VP == settlements + 2*cities.
  for (const p of game.players) {
    if (p.victoryPoints !== p.settlements + 2 * p.cities) fail(`VP mismatch ${p.name}`, game);
  }
  // 5. Supply limits respected.
  for (const p of game.players) {
    if (p.roads > SUPPLY_LIMITS.roads) fail(`road supply exceeded ${p.name}`, game);
    if (p.settlements > SUPPLY_LIMITS.settlements) fail(`settlement supply exceeded ${p.name}`, game);
    if (p.cities > SUPPLY_LIMITS.cities) fail(`city supply exceeded ${p.name}`, game);
    if (p.settlements < 0 || p.cities < 0) fail(`negative piece count ${p.name}`, game);
  }
}

for (let g = 0; g < GAMES; g++) {
  const board = generateBoard();
  let game = createInitialGame(board, 3 + (g % 2)); // alternate 3 and 4 players
  const apply = (action) => {
    game = gameReducer(game, action, board);
  };

  // --- Setup (snake draft) ---
  let guard = 0;
  while (isSetupPhase(game.phase) && guard++ < 200) {
    if (!game.awaitingRoad) {
      const spots = validSettlementSpots(game, board, { setup: true });
      if (!spots.length) { fail('no settlement spots in setup', game); break; }
      apply({ type: ACTIONS.PLACE_SETTLEMENT, vertexId: pick(spots) });
    } else {
      const roads = validRoadSpots(game, board, { setup: true, player: game.currentPlayer, settlementVertex: game.lastSettlement });
      if (!roads.length) { fail('no road spots in setup', game); break; }
      apply({ type: ACTIONS.PLACE_ROAD, edgeId: pick(roads) });
    }
    checkInvariants(game, board, 'setup');
  }

  // Post-setup checks.
  if (game.phase !== PHASES.ROLL) fail('setup did not reach ROLL', game);
  for (const p of game.players) {
    if (p.settlements !== 2) fail(`${p.name} should have 2 settlements`, game);
    if (p.roads !== 2) fail(`${p.name} should have 2 roads`, game);
  }

  // --- Main loop ---
  for (let t = 0; t < TURNS && game.phase !== PHASES.GAME_OVER; t++) {
    if (game.phase !== PHASES.ROLL) { fail('expected ROLL at turn start', game); break; }
    const dice = [d6(), d6()];
    const total = dice[0] + dice[1];
    if (total === 7) sevens++;
    const handsBefore = game.players.map((p) => handTotal(p.resources));
    apply({ type: ACTIONS.ROLL_DICE, dice });
    checkInvariants(game, board, 'roll');
    if (total === 7 && handsBefore.some((b, i) => handTotal(game.players[i].resources) < b)) discards++;

    if (game.phase === PHASES.MOVE_ROBBER) {
      const target = pick([...board.hexes.keys()].filter((id) => id !== game.robberHex));
      apply({ type: ACTIONS.MOVE_ROBBER, hexId: target });
      if (game.pendingSteal) {
        const victim = pick(game.pendingSteal.candidates);
        const v = game.players[victim];
        const poolRes = RESOURCE_KEYS.filter((r) => v.resources[r] > 0);
        apply({ type: ACTIONS.STEAL, fromPlayer: victim, resource: pick(poolRes) });
        steals++;
      }
      checkInvariants(game, board, 'robber');
    }

    // TRADE -> BUILD
    apply({ type: ACTIONS.NEXT_PHASE });

    // Build greedily, prioritising VP (cities > settlements > roads).
    let bg = 0;
    while (game.phase === PHASES.BUILD && bg++ < 30) {
      const v = game.valid;
      if (v.cities.length) apply({ type: ACTIONS.BUILD_CITY, vertexId: pick(v.cities) });
      else if (v.settlements.length) apply({ type: ACTIONS.BUILD_SETTLEMENT, vertexId: pick(v.settlements) });
      else if (v.roads.length) apply({ type: ACTIONS.BUILD_ROAD, edgeId: pick(v.roads) });
      else break;
      builds++;
      checkInvariants(game, board, 'build');
      if (game.phase === PHASES.GAME_OVER) break;
    }

    if (game.phase === PHASES.GAME_OVER) { wins++; break; }
    apply({ type: ACTIONS.NEXT_PHASE }); // BUILD -> END_TURN
    checkInvariants(game, board, 'endturn');
  }
}

console.log(`Games:            ${GAMES} (alternating 3/4 players)`);
console.log(`Turns each:       ${TURNS}`);
console.log(`Sevens rolled:    ${sevens}`);
console.log(`Discards:         ${discards}`);
console.log(`Steals:           ${steals}`);
console.log(`Builds:           ${builds}`);
console.log(`Games won (10VP): ${wins}`);
console.log(`Invariant fails:  ${failures}`);
console.log(failures === 0 ? '\nPASS — all invariants held.' : '\nFAILURES present.');
process.exit(failures === 0 ? 0 : 1);
