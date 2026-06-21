// ---------------------------------------------------------------------------
// Hex math for a FLAT-TOP hexagonal grid using cube coordinates.
//
// Reference: https://www.redblobgames.com/grids/hexagons/  (the definitive
// hex-grid guide — read it before changing anything in this file).
//
// A hex is { q, r, s } where the cube constraint q + r + s = 0 always holds.
// Keeping the third axis around makes neighbours, rings and rounding trivial.
// This module is pure geometry — no React, no game rules.
// ---------------------------------------------------------------------------

export const SQRT3 = Math.sqrt(3);

/** Build a hex from axial (q, r); derives s so q + r + s = 0. */
export function hex(q, r) {
  return { q, r, s: -q - r };
}

/** Stable string id for a hex, e.g. "1,-2". */
export function hexId(h) {
  return `${h.q},${h.r}`;
}

export function hexEquals(a, b) {
  return a.q === b.q && a.r === b.r && a.s === b.s;
}

export function hexAdd(a, b) {
  return { q: a.q + b.q, r: a.r + b.r, s: a.s + b.s };
}

export function hexScale(h, k) {
  return { q: h.q * k, r: h.r * k, s: h.s * k };
}

// The six neighbour directions, ordered clockwise starting from "east".
// Index 0..5 — used by hexNeighbor() and hexRing().
export const HEX_DIRECTIONS = [
  { q: 1, r: 0, s: -1 },
  { q: 1, r: -1, s: 0 },
  { q: 0, r: -1, s: 1 },
  { q: -1, r: 0, s: 1 },
  { q: -1, r: 1, s: 0 },
  { q: 0, r: 1, s: -1 },
];

export function hexNeighbor(h, direction) {
  return hexAdd(h, HEX_DIRECTIONS[((direction % 6) + 6) % 6]);
}

/** All six neighbours of a hex. */
export function hexNeighbors(h) {
  return HEX_DIRECTIONS.map((_, i) => hexNeighbor(h, i));
}

/** Distance between two hexes (number of steps). */
export function hexDistance(a, b) {
  return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
}

/**
 * The ring of hexes at exactly `radius` steps from `center`.
 * radius 0 -> just the center; radius 1 -> 6 hexes; radius 2 -> 12 hexes.
 */
export function hexRing(center, radius) {
  if (radius <= 0) return [{ ...center }];
  const results = [];
  // Walk to a corner of the ring, then step around its six sides.
  let h = hexAdd(center, hexScale(HEX_DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(h);
      h = hexNeighbor(h, side);
    }
  }
  return results;
}

/**
 * The center plus every ring out to `radius`, returned center-first.
 * radius 2 yields the classic 19-hex Catan board (1 + 6 + 12).
 */
export function hexSpiral(center, radius) {
  const results = [{ ...center }];
  for (let k = 1; k <= radius; k++) {
    results.push(...hexRing(center, k));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Pixel layout (flat-top)
// ---------------------------------------------------------------------------

/**
 * Convert a hex to the pixel coordinate of its center.
 * `size` is the hex radius (center -> corner distance).
 * Flat-top layout matrix from redblobgames.
 */
export function hexToPixel(h, size, origin = { x: 0, y: 0 }) {
  const x = size * (1.5 * h.q);
  const y = size * ((SQRT3 / 2) * h.q + SQRT3 * h.r);
  return { x: x + origin.x, y: y + origin.y };
}

/**
 * The six corner points of a flat-top hex, clockwise from the right-most.
 * Corner i sits at angle 60*i degrees from the center.
 */
export function hexCorners(center, size) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

/** Flat-top metrics for a given hex `size` (useful for layout/spacing). */
export function hexMetrics(size) {
  return {
    width: 2 * size, // corner-to-corner across the flat top
    height: SQRT3 * size, // point-to-point vertically
    horizSpacing: 1.5 * size, // x distance between adjacent column centers
    vertSpacing: SQRT3 * size, // y distance between stacked centers
  };
}
