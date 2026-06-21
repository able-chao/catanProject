// ---------------------------------------------------------------------------
// Harbours / ports. Phase 2 outline: 9 ports — 5 generic 3:1 and four specific
// 2:1 (ore, wheat, wood, sheep). Each port sits on a COASTAL edge (an edge
// belonging to only one hex) and grants trade access to that edge's 2 vertices.
//
// We pick 9 coastal edges spread evenly around the board's perimeter, never
// letting two ports share a vertex, then deal the 9 port types onto them.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

// 5 generic + 4 specific. Colours mirror the matching terrain tiles.
export const PORT_TYPES = [
  { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  { kind: 'generic', ratio: 3, yields: null, label: '3:1 Any', color: '#cdd3db' },
  { kind: 'ore', ratio: 2, yields: 'ore', label: '2:1 Ore', color: '#9aa3ad' },
  { kind: 'wheat', ratio: 2, yields: 'grain', label: '2:1 Wheat', color: '#e6b422' },
  { kind: 'wood', ratio: 2, yields: 'lumber', label: '2:1 Wood', color: '#3f7a34' },
  { kind: 'sheep', ratio: 2, yields: 'wool', label: '2:1 Sheep', color: '#8fbf57' },
];

const PORT_COUNT = PORT_TYPES.length;

/**
 * Choose port edges and build the ports map.
 * @returns {Map<portId, Port>}
 */
export function placePorts(geometry, rng) {
  const { edges, vertices, size } = geometry;

  // Coastal edges, sorted by angle around the board centre (the centre hex is
  // at the pixel origin, so atan2 of the edge midpoint orders them around the
  // ring).
  const coastal = [...edges.values()]
    .filter((e) => e.coastal)
    .map((e) => {
      const mx = (e.x1 + e.x2) / 2;
      const my = (e.y1 + e.y2) / 2;
      return { edge: e, mx, my, angle: Math.atan2(my, mx) };
    })
    .sort((a, b) => a.angle - b.angle);

  // Walk the ring at an even stride, taking edges that don't share a vertex
  // with one already chosen.
  const stride = coastal.length / PORT_COUNT;
  const chosen = [];
  const usedVertices = new Set();

  const tryTake = (candidate) => {
    if (!candidate || candidate.edge.portId) return false;
    if (candidate.edge.vertexIds.some((v) => usedVertices.has(v))) return false;
    chosen.push(candidate);
    candidate.edge.vertexIds.forEach((v) => usedVertices.add(v));
    return true;
  };

  for (let i = 0; i < PORT_COUNT; i++) {
    let idx = Math.round(i * stride) % coastal.length;
    // If the ideal slot conflicts, scan forward for the next free edge.
    for (let step = 0; step < coastal.length; step++) {
      if (tryTake(coastal[(idx + step) % coastal.length])) break;
    }
  }

  // Deal port types and build the map.
  const types = shuffle(PORT_TYPES, rng);
  const ports = new Map();
  chosen
    .sort((a, b) => a.angle - b.angle)
    .forEach((c, i) => {
      const type = types[i];
      const id = `p${i}`;
      // Push the marker outward from the board centre along the edge normal.
      const len = Math.hypot(c.mx, c.my) || 1;
      const offset = size * 0.62;
      const port = {
        id,
        ...type,
        edgeId: c.edge.id,
        vertexIds: [...c.edge.vertexIds],
        x: c.mx + (c.mx / len) * offset,
        y: c.my + (c.my / len) * offset,
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
