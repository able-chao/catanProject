// ---------------------------------------------------------------------------
// Harbours / ports. Each port sits on a COASTAL edge (an edge belonging to
// only one hex) and grants trade access to that edge's 2 vertices.
//
// The mix of ports comes from the map definition (portCounts) — classic runs
// the familiar 5× 3:1 + four 2:1s; bigger maps scale up and may include every
// resource. We pick edges spread evenly around the perimeter, never letting
// two ports share a vertex, then deal the shuffled port types onto them.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

// Port kind -> trade metadata. Colours mirror the matching terrain tiles.
export const PORT_KINDS = {
  generic: { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  ore: { kind: 'ore', ratio: 2, yields: 'ore', label: '2:1 Ore', color: '#9aa3ad' },
  wheat: { kind: 'wheat', ratio: 2, yields: 'grain', label: '2:1 Wheat', color: '#e6b422' },
  wood: { kind: 'wood', ratio: 2, yields: 'lumber', label: '2:1 Wood', color: '#3f7a34' },
  sheep: { kind: 'sheep', ratio: 2, yields: 'wool', label: '2:1 Sheep', color: '#8fbf57' },
  brick: { kind: 'brick', ratio: 2, yields: 'brick', label: '2:1 Brick', color: '#c45a3b' },
};

/** A map's portCounts ({ generic: 5, ore: 1, … }) as a flat list of types. */
export function buildPortTypes(portCounts) {
  return Object.entries(portCounts).flatMap(([kind, n]) => Array(n).fill(PORT_KINDS[kind]));
}

/**
 * Choose port edges and build the ports map.
 * `portZone: 'inner'` restricts ports to the coastline nearest the board's
 * centre (e.g. Black Forest's central lagoon), overflowing outward only if the
 * inner coast can't fit them all.
 * @returns {Map<portId, Port>}
 */
export function placePorts(geometry, rng, portCounts, portZone) {
  const { edges, vertices, hexes, size } = geometry;
  const portTypes = buildPortTypes(portCounts);
  const portCount = portTypes.length;

  // Board centroid — maps aren't necessarily centred on the pixel origin, so
  // order coastal edges by angle around the actual centre of mass.
  let cx = 0;
  let cy = 0;
  for (const h of hexes.values()) {
    cx += h.center.x;
    cy += h.center.y;
  }
  cx /= hexes.size;
  cy /= hexes.size;

  // Coastal edges, sorted by angle around the centroid.
  const coastalAll = [...edges.values()]
    .filter((e) => e.coastal)
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      return { edge: e, mx, my, angle: Math.atan2(my - cy, mx - cx), radius: Math.hypot(mx - cx, my - cy) };
    })
    .sort((a, b) => a.angle - b.angle);

  let coastal = coastalAll;
  if (portZone === 'inner') {
    const radii = coastalAll.map((c) => c.radius);
    const cut = (Math.min(...radii) + Math.max(...radii)) / 2;
    const inner = coastalAll.filter((c) => c.radius < cut);
    if (inner.length >= portCount) coastal = inner;
  }

  // Walk the ring at an even stride, taking edges that don't share a vertex
  // with one already chosen.
  const stride = coastal.length / portCount;
  const chosen = [];
  const usedVertices = new Set();

  const tryTake = (candidate) => {
    if (!candidate || candidate.edge.portId) return false;
    if (candidate.edge.vertexIds.some((v) => usedVertices.has(v))) return false;
    chosen.push(candidate);
    candidate.edge.vertexIds.forEach((v) => usedVertices.add(v));
    return true;
  };

  for (let i = 0; i < portCount; i++) {
    let idx = Math.round(i * stride) % coastal.length;
    // If the ideal slot conflicts, scan forward for the next free edge.
    for (let step = 0; step < coastal.length; step++) {
      if (tryTake(coastal[(idx + step) % coastal.length])) break;
    }
  }

  // If a restricted zone couldn't seat every port, overflow onto the rest of
  // the coastline rather than shorting the map.
  if (chosen.length < portCount && coastal !== coastalAll) {
    for (const c of coastalAll) {
      if (chosen.length >= portCount) break;
      tryTake(c);
    }
  }

  // Deal port types and build the map.
  const types = shuffle(portTypes, rng);
  const ports = new Map();
  chosen
    .sort((a, b) => a.angle - b.angle)
    .forEach((c, i) => {
      const type = types[i];
      const id = `p${i}`;
      // Push the marker seaward along the edge's true outward normal: from the
      // owning hex's centre through the edge midpoint. (Centroid-based
      // directions point the wrong way inside concave coastlines.)
      const owner = hexes.get(c.edge.hexIds[0]);
      const dx = c.mx - owner.center.x;
      const dy = c.my - owner.center.y;
      const len = Math.hypot(dx, dy) || 1;
      const offset = size * 0.62;
      const port = {
        id,
        ...type,
        edgeId: c.edge.id,
        vertexIds: [...c.edge.vertexIds],
        x: c.mx + (dx / len) * offset,
        y: c.my + (dy / len) * offset,
      };
      ports.set(id, port);
      c.edge.portId = id;
      c.edge.vertexIds.forEach((v) => {
        const vertex = vertices.get(v);
        if (vertex) vertex.portId = id;
      });
    });

  return ports;
}
