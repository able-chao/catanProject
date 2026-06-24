// ---------------------------------------------------------------------------
// Board model.
//
// Phase 1 gave us the geometry; Phase 2 layers on terrain, number tokens and
// ports. Per the outline, EVERYTHING is stored as flat Maps keyed by id —
// no nested arrays, no 2D grids. Flat id-keyed maps serialize cleanly, diff
// cleanly, and (later) sync cleanly over the network.
//
//   hexes:    Map<hexId, Hex>        ("0,0" -> { resource, token, ... })
//   vertices: Map<vertexId, Vertex>  settlement spots
//   edges:    Map<edgeId, Edge>      road spots
//   ports:    Map<portId, Port>
//
// hexOrder is the one ordered list we keep: hex ids in spiral order, so tiles
// and tokens can be assigned "in spiral order" as the outline asks.
// ---------------------------------------------------------------------------

import { hex, hexId, hexSpiral, hexToPixel, hexCorners, hexNeighbors } from '../utils/hex.js';
import { mulberry32, randomSeed } from '../utils/random.js';
import { RESOURCES, TILE_COUNTS, assignTiles } from './tiles.js';
import { placeTokens } from './tokens.js';
import { placePorts } from './ports.js';

const CENTER = hex(0, 0);

// Round to 2dp so corners/edges shared between hexes hash to the same key.
function pointKey(p) {
  return `${Math.round(p.x * 100) / 100}:${Math.round(p.y * 100) / 100}`;
}

/**
 * Build the pure geometry (no resources/tokens/ports yet) as flat maps.
 * radius 2 -> the classic 19-hex board, 54 vertices, 72 edges.
 */
export function buildGeometry(size, radius) {
  const hexes = new Map();
  const hexOrder = [];
  for (const h of hexSpiral(CENTER, radius)) {
    const id = hexId(h);
    const center = hexToPixel(h, size);
    hexes.set(id, {
      id,
      q: h.q,
      r: h.r,
      s: h.s,
      center,
      corners: hexCorners(center, size),
      vertexIds: [],
      edgeIds: [],
      neighborIds: [],
      resource: null,
      yields: null,
      token: null,
    });
    hexOrder.push(id);
  }

  // Neighbours that actually exist on the board.
  for (const tile of hexes.values()) {
    tile.neighborIds = hexNeighbors(tile)
      .map((n) => hexId(n))
      .filter((id) => hexes.has(id));
  }

  // Vertices (settlement spots) — dedupe shared corners by rounded position.
  const vertexByPoint = new Map();
  const vertices = new Map();
  for (const tile of hexes.values()) {
    for (const corner of tile.corners) {
      const key = pointKey(corner);
      let v = vertexByPoint.get(key);
      if (!v) {
        v = { id: `v${vertices.size}`, x: corner.x, y: corner.y, hexIds: [], edgeIds: [], adjacentVertexIds: [], coastal: false, portId: null };
        vertexByPoint.set(key, v);
        vertices.set(v.id, v);
      }
      v.hexIds.push(tile.id);
      tile.vertexIds.push(v.id);
    }
  }

  // Edges (road spots) — keyed by midpoint; linked to their two vertices.
  const edgeByPoint = new Map();
  const edges = new Map();
  for (const tile of hexes.values()) {
    for (let i = 0; i < 6; i++) {
      const a = tile.corners[i];
      const b = tile.corners[(i + 1) % 6];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const key = pointKey(mid);
      let e = edgeByPoint.get(key);
      if (!e) {
        const va = vertexByPoint.get(pointKey(a));
        const vb = vertexByPoint.get(pointKey(b));
        e = {
          id: `e${edges.size}`,
          x1: a.x,
          y1: a.y,
          x2: b.x,
          y2: b.y,
          vertexIds: [va.id, vb.id],
          hexIds: [],
          coastal: false,
          portId: null,
        };
        edgeByPoint.set(key, e);
        edges.set(e.id, e);
        // Wire up vertex <-> edge and vertex <-> vertex adjacency.
        va.edgeIds.push(e.id);
        vb.edgeIds.push(e.id);
        va.adjacentVertexIds.push(vb.id);
        vb.adjacentVertexIds.push(va.id);
      }
      e.hexIds.push(tile.id);
      tile.edgeIds.push(e.id);
    }
  }

  // Coastal = on the board's edge. Edges with one hex; vertices with < 3 hexes.
  for (const e of edges.values()) e.coastal = e.hexIds.length === 1;
  for (const v of vertices.values()) v.coastal = v.hexIds.length < 3;

  return { size, radius, bounds: computeBounds(hexes, size), hexOrder, hexes, vertices, edges };
}

/**
 * Generate a complete random board: geometry + terrain + tokens + ports.
 * Pass a `seed` to reproduce a specific board.
 */
export function generateBoard({ size = 56, radius = 2, seed = randomSeed() } = {}) {
  const rng = mulberry32(seed);
  const geometry = buildGeometry(size, radius);

  // Terrain.
  const tileByHex = assignTiles(geometry.hexOrder, rng);
  for (const [id, terrain] of tileByHex) {
    const tile = geometry.hexes.get(id);
    tile.resource = terrain;
    tile.yields = RESOURCES[terrain].yields;
  }

  // Number tokens (respecting the 6/8 non-adjacency rule).
  const { numberByHex, attempts } = placeTokens(geometry.hexOrder, geometry.hexes, rng);
  for (const tile of geometry.hexes.values()) {
    tile.token = numberByHex.get(tile.id) ?? null;
  }

  // Ports.
  const ports = placePorts(geometry, rng);

  return { ...geometry, ports, seed, tokenAttempts: attempts };
}

/** Tight pixel bounding box around all hex corners, for the SVG viewBox. */
function computeBounds(hexes, size) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tile of hexes.values()) {
    for (const c of tile.corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
  }
  const pad = size * 1.4; // room for the port markers that sit outside the land
  return { minX: minX - pad, minY: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
}

/**
 * Sanity-check a generated board. Used by the UI to display live validation.
 * Returns counts plus the all-important red-adjacency tally (must be 0).
 */
export function validateBoard(board) {
  const tiles = [...board.hexes.values()];

  const resourceCounts = {};
  for (const t of tiles) resourceCounts[t.resource] = (resourceCounts[t.resource] ?? 0) + 1;

  const numberCounts = {};
  for (const t of tiles) {
    if (t.token) numberCounts[t.token.number] = (numberCounts[t.token.number] ?? 0) + 1;
  }

  let redAdjacencies = 0;
  for (const t of tiles) {
    if (!t.token?.red) continue;
    for (const n of t.neighborIds) {
      if (board.hexes.get(n).token?.red) redAdjacencies++;
    }
  }
  redAdjacencies /= 2; // each adjacency counted from both ends

  const tileCountsOk = Object.entries(TILE_COUNTS).every(
    ([terrain, n]) => resourceCounts[terrain] === n,
  );

  return {
    resourceCounts,
    numberCounts,
    redAdjacencies,
    tileCountsOk,
    portCount: board.ports.size,
    valid: redAdjacencies === 0 && tileCountsOk && board.ports.size === 9,
  };
}
