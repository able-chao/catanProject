// ---------------------------------------------------------------------------
// Longest Road.
//
// Key insight (from the Phase 5 outline): this DFS must track visited EDGES,
// not vertices — a road is a trail that may revisit a vertex but never reuse an
// edge. We try every endpoint as a start and follow branches. An opponent's
// building on a vertex splits the chain: you may start a road from that vertex
// but you cannot pass *through* it.
// ---------------------------------------------------------------------------

/** Length (in edges) of a player's longest continuous road. */
export function longestRoadLength(game, board, playerId) {
  const myEdges = new Set(
    Object.keys(game.roads).filter((eid) => game.roads[eid] === playerId),
  );
  if (myEdges.size === 0) return 0;

  // A vertex is "blocked" for traversal if an opponent has built on it: you
  // can leave it (start there) but cannot continue through it.
  const blocked = (vid) => {
    const b = game.buildings[vid];
    return b && b.player !== playerId;
  };

  let best = 0;

  // canContinue is true at the start vertex (you may always leave it) and
  // false once you arrive at a blocked vertex.
  const dfs = (vertex, visited, length, canContinue) => {
    if (length > best) best = length;
    if (!canContinue) return;
    for (const eid of board.vertices.get(vertex).edgeIds) {
      if (!myEdges.has(eid) || visited.has(eid)) continue;
      const e = board.edges.get(eid);
      const next = e.vertexIds[0] === vertex ? e.vertexIds[1] : e.vertexIds[0];
      visited.add(eid);
      dfs(next, visited, length + 1, !blocked(next));
      visited.delete(eid);
    }
  };

  const endpoints = new Set();
  for (const eid of myEdges) {
    const e = board.edges.get(eid);
    endpoints.add(e.vertexIds[0]);
    endpoints.add(e.vertexIds[1]);
  }
  for (const start of endpoints) dfs(start, new Set(), 0, true);

  return best;
}

const MIN_LONGEST_ROAD = 5;

/**
 * Decide who holds the Longest Road after a change, given the previous holder.
 * Awarded at 5+. It only moves on a STRICT lead; ties keep the incumbent (or
 * stay unawarded if no incumbent qualifies). Returns { holder, length }.
 */
export function awardLongestRoad(game, board) {
  const lengths = game.players.map((p) => longestRoadLength(game, board, p.id));
  const max = Math.max(...lengths);
  const prev = game.longestRoad;

  if (max < MIN_LONGEST_ROAD) {
    return { holder: null, length: max };
  }

  const leaders = game.players.filter((p) => lengths[p.id] === max).map((p) => p.id);

  // Incumbent still tied for the lead keeps the card.
  if (prev != null && leaders.includes(prev)) {
    return { holder: prev, length: max };
  }
  // A single new leader takes it; a contested tie with no incumbent awards none.
  if (leaders.length === 1) {
    return { holder: leaders[0], length: max };
  }
  return { holder: null, length: max };
}
