// Stress-test board generation: assert every random board on every map is
// valid (tile counts, no adjacent 6/8, 9 ports).
// Run: node scripts/stress-test.mjs [iterations-per-map]
import { generateBoard, validateBoard } from '../src/board/board.js';
import { MAPS, getMap } from '../src/board/maps.js';

const N = Number(process.argv[2] ?? 5000);
let failures = 0;

for (const mapId of Object.keys(MAPS)) {
  const map = getMap(mapId);
  let worstAttempts = 0;
  let totalAttempts = 0;
  let mapFailures = 0;

  for (let i = 0; i < N; i++) {
    const board = generateBoard({ mapId });
    const r = validateBoard(board);
    worstAttempts = Math.max(worstAttempts, board.tokenAttempts);
    totalAttempts += board.tokenAttempts;

    const hexCountOk = board.hexes.size === map.coords.length;
    const tokensOk =
      [...board.hexes.values()].filter((h) => h.token).length === map.tokenNumbers.length;

    if (!r.valid || !hexCountOk || !tokensOk) {
      mapFailures++;
      console.error(`FAIL map=${mapId} seed=${board.seed}`, { ...r, hexCountOk, tokensOk });
    }
  }

  failures += mapFailures;
  console.log(`--- ${map.name} (${map.coords.length} hexes) ---`);
  console.log(`Boards generated:        ${N}`);
  console.log(`Invalid boards:          ${mapFailures}`);
  console.log(`Token attempts (avg):    ${(totalAttempts / N).toFixed(2)}`);
  console.log(`Token attempts (worst):  ${worstAttempts}`);
}

console.log(failures === 0 ? '\nPASS — every board on every map valid.' : '\nFAILURES present.');
process.exit(failures === 0 ? 0 : 1);
