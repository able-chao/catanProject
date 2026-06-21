// Stress-test board generation: assert every random board is valid.
// Run: node scripts/stress-test.mjs [iterations]
import { generateBoard, validateBoard } from '../src/board/board.js';

const N = Number(process.argv[2] ?? 5000);
let worstAttempts = 0;
let totalAttempts = 0;
let failures = 0;

for (let i = 0; i < N; i++) {
  const board = generateBoard();
  const r = validateBoard(board);
  worstAttempts = Math.max(worstAttempts, board.tokenAttempts);
  totalAttempts += board.tokenAttempts;
  if (!r.valid) {
    failures++;
    console.error(`FAIL seed=${board.seed}`, r);
  }
}

console.log(`Boards generated:        ${N}`);
console.log(`Invalid boards:          ${failures}`);
console.log(`Token attempts (avg):    ${(totalAttempts / N).toFixed(2)}`);
console.log(`Token attempts (worst):  ${worstAttempts}`);
console.log(failures === 0 ? '\nPASS — every board valid.' : '\nFAILURES present.');
process.exit(failures === 0 ? 0 : 1);
