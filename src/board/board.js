// ---------------------------------------------------------------------------
// Board generation (Phase 1: geometry only — no resources, numbers or rules).
//
// Produces the classic 19-hex board (radius 2) and PRE-COMPUTES the shared
// vertices (settlement spots) and edges (road spots). Adjacent hexes share
// corners/edges, so we dedupe by rounded pixel position: any two hexes whose
// corners land on the same point are referencing the same vertex.
//
//   vertexId -> [hexId, hexId, hexId]   (1–3 hexes meet at a vertex)
//   edgeId   -> [hexId, hexId]          (1–2 hexes share an edge)
//
// For a 19-hex board this yields 54 vertices and 72 edges — exactly the
// settlement/road counts of real Catan, a handy correctness check.
// ---------------------------------------------------------------------------

import { hex, hexId, hexSpiral, hexToPixel, hexCorners } from '../utils/hex.js';

const CENTER = hex(0, 0);

// Round to 2dp so corners shared between hexes hash to the same key despite
// floating-point noise from the trig in hexCorners().
function pointKey(p) {
  return `${Math.round(p.x * 100) / 100}:${Math.round(p.y * 100) / 100}`;
}

/**
 * @param {object} opts
 * @param {number} [opts.size=56]   hex radius in pixels
 * @param {number} [opts.radius=2]  board radius (2 = 19 hexes)
 */
export function generateBoard({ size = 56, radius = 2 } = {}) {
  // --- Hexes ---------------------------------------------------------------
  const hexes = hexSpiral(CENTER, radius).map((h) => {
    const center = hexToPixel(h, size);
    return {
      id: hexId(h),
      q: h.q,
      r: h.r,
      s: h.s,
      center,
      corners: hexCorners(center, size),
      vertexIds: [],
      edgeIds: [],
    };
  });

  // --- Vertices (settlement spots) -----------------------------------------
  const vertexByPoint = new Map();
  const vertices = [];
  for (const tile of hexes) {
    for (const corner of tile.corners) {
      const key = pointKey(corner);
      let v = vertexByPoint.get(key);
      if (!v) {
        v = { id: `v${vertices.length}`, x: corner.x, y: corner.y, hexes: [] };
        vertexByPoint.set(key, v);
        vertices.push(v);
      }
      v.hexes.push(tile.id);
      tile.vertexIds.push(v.id);
    }
  }

  // --- Edges (road spots) --------------------------------------------------
  // An edge connects corner i -> i+1 of a hex; keyed by its midpoint.
  const edgeByPoint = new Map();
  const edges = [];
  for (const tile of hexes) {
    for (let i = 0; i < 6; i++) {
      const a = tile.corners[i];
      const b = tile.corners[(i + 1) % 6];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const key = pointKey(mid);
      let e = edgeByPoint.get(key);
      if (!e) {
        e = { id: `e${edges.length}`, x1: a.x, y1: a.y, x2: b.x, y2: b.y, hexes: [] };
        edgeByPoint.set(key, e);
        edges.push(e);
      }
      e.hexes.push(tile.id);
      tile.edgeIds.push(e.id);
    }
  }

  // The exact structure the Phase 1 outline asks for: vertexId -> [HexId...].
  const vertexToHexes = new Map(vertices.map((v) => [v.id, v.hexes]));
  const edgeToHexes = new Map(edges.map((e) => [e.id, e.hexes]));

  return {
    size,
    radius,
    hexes,
    vertices,
    edges,
    vertexToHexes,
    edgeToHexes,
    bounds: computeBounds(hexes, size),
  };
}

/** Tight pixel bounding box around all hex corners, for the SVG viewBox. */
function computeBounds(hexes, size) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tile of hexes) {
    for (const c of tile.corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }
  const pad = size * 0.6;
  return {
    minX: minX - pad,
    minY: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  };
}
