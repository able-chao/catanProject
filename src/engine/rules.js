// Pure placement rules. Used both by the reducer (to reject illegal actions)
// and by the UI (to highlight legal spots).

/** Is this vertex already built on? */
export function vertexOccupied(state, vertexId) {
  return Boolean(state.buildings[vertexId]);
}

/** Distance rule: no settlement may touch another settlement/city. */
export function hasAdjacentBuilding(state, board, vertexId) {
  const v = board.vertices.get(vertexId);
  return v.adjacentVertexIds.some((adj) => state.buildings[adj]);
}

/**
 * Can `player` place a settlement on `vertexId`?
 * During setup any legal (unoccupied + distance rule) spot works; afterwards
 * the spot must also connect to one of the player's roads.
 */
export function canPlaceSettlement(state, board, vertexId, { setup, player }) {
  if (vertexOccupied(state, vertexId)) return false;
  if (hasAdjacentBuilding(state, board, vertexId)) return false;
  if (!setup) {
    const v = board.vertices.get(vertexId);
    const connected = v.edgeIds.some((eid) => state.roads[eid] === player);
    if (!connected) return false;
  }
  return true;
}

export function validSettlementSpots(state, board, opts) {
  return [...board.vertices.keys()].filter((id) =>
    canPlaceSettlement(state, board, id, opts),
  );
}

/**
 * Can `player` place a road on `edgeId`?
 * During setup it must touch the settlement just placed; afterwards it must
 * connect to one of the player's roads or buildings.
 */
export function canPlaceRoad(state, board, edgeId, { setup, player, settlementVertex }) {
  if (state.roads[edgeId] != null) return false;
  const e = board.edges.get(edgeId);

  if (setup) {
    return e.vertexIds.includes(settlementVertex);
  }

  return e.vertexIds.some((vid) => {
    const building = state.buildings[vid];
    // An opponent's building on a shared vertex breaks the chain: you may not
    // extend a road *through* it, even if your own road also touches it.
    if (building && building.player !== player) return false;
    if (building && building.player === player) return true;
    const v = board.vertices.get(vid);
    return v.edgeIds.some((eid) => eid !== edgeId && state.roads[eid] === player);
  });
}

export function validRoadSpots(state, board, opts) {
  return [...board.edges.keys()].filter((id) =>
    canPlaceRoad(state, board, id, opts),
  );
}
