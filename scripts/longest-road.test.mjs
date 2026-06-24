// Unit tests for the Longest Road DFS (visited-EDGES trail search).
// Build tiny synthetic graphs so the expected answers are obvious.
//   node scripts/longest-road.test.mjs
import { longestRoadLength } from '../src/engine/longestRoad.js';

// edges: [ [id, vA, vB], ... ]  -> a board-shaped object with the bits the DFS uses.
function fakeBoard(edges) {
  const vertices = new Map();
  const edgeMap = new Map();
  const touch = (v) => {
    if (!vertices.has(v)) vertices.set(v, { id: v, edgeIds: [] });
    return vertices.get(v);
  };
  for (const [id, a, b] of edges) {
    edgeMap.set(id, { id, vertexIds: [a, b] });
    touch(a).edgeIds.push(id);
    touch(b).edgeIds.push(id);
  }
  return { vertices, edges: edgeMap };
}

let pass = 0;
let fail = 0;
function check(name, got, want) {
  if (got === want) { pass++; console.log(`  ✓ ${name} = ${got}`); }
  else { fail++; console.error(`  ✗ ${name}: got ${got}, want ${want}`); }
}

const P0 = 0;
const allRoads = (board) =>
  Object.fromEntries([...board.edges.keys()].map((id) => [id, P0]));

// 1. Straight line of 4 edges -> 4
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D'],['de','D','E']]);
  check('line-4', longestRoadLength({ roads: allRoads(b), buildings: {} }, b, P0), 4);
}

// 2. Same line, opponent building on the middle vertex C -> split into 2 + 2 = max 2
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D'],['de','D','E']]);
  const game = { roads: allRoads(b), buildings: { C: { player: 1, type: 'settlement' } } };
  check('line-4-split-at-C', longestRoadLength(game, b, P0), 2);
}

// 3. Branch (Y shape): line A-B-C-D + branch C-E -> longest trail is 3 edges
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D'],['ce','C','E']]);
  check('branch-Y', longestRoadLength({ roads: allRoads(b), buildings: {} }, b, P0), 3);
}

// 4. Triangle cycle (3 edges) -> trail can use all 3 -> 3
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['ca','C','A']]);
  check('triangle', longestRoadLength({ roads: allRoads(b), buildings: {} }, b, P0), 3);
}

// 5. Lollipop: tail A-B-C + triangle C-D-E-C. The trail A-B-C-D-E-C uses the
//    tail then loops the whole triangle without reusing an edge -> 5.
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D'],['de','D','E'],['ec','E','C']]);
  check('lollipop', longestRoadLength({ roads: allRoads(b), buildings: {} }, b, P0), 5);
}

// 6. Own building in the middle does NOT split the chain
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D'],['de','D','E']]);
  const game = { roads: allRoads(b), buildings: { C: { player: P0, type: 'city' } } };
  check('own-building-no-split', longestRoadLength(game, b, P0), 4);
}

// 7. Only the player's own roads count
{
  const b = fakeBoard([['ab','A','B'],['bc','B','C'],['cd','C','D']]);
  const game = { roads: { ab: P0, bc: 1, cd: P0 }, buildings: {} };
  check('mixed-owners', longestRoadLength(game, b, P0), 1);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
