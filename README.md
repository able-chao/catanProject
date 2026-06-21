# Catan

A Catan clone built with **React + SVG**, developed in 7 phases.

| Phase | Focus |
| ----- | ----- |
| **1. Foundation** ✅ | Hex math, cube coordinate system, grid rendering |
| 2. Board Gen | Resources, number tokens, randomized layout |
| 3. Game Engine | Turns, dice, state machine |
| 4. Building | Settlements, cities, roads |
| 5. Trading | Bank / player trades |
| 6. UI & Polish | Animations, sound, theming |
| 7. Multiplayer | Networked play |

## Phase 1 — Foundation (current)

Pure geometry and rendering. **No game logic yet.**

- **Cube coordinates** (`q + r + s = 0`) — the foundation everything builds on.
- **Flat-top hexagons** laid out with pixel-perfect spacing.
- The classic **19-hex board** (radius 2: `1 + 6 + 12`).
- **Pre-computed shared vertices & edges** — adjacent hexes share corners
  (settlement spots) and edges (road spots), deduped into
  `vertexId → [HexId, …]` and `edgeId → [HexId, …]` maps. This yields exactly
  **54 vertices** and **72 edges** — matching real Catan.

The control panel toggles overlays for hex coordinates, vertices, and edges.

## Stack

- [Vite](https://vite.dev/) + React (JavaScript)
- [Zustand](https://github.com/pmndrs/zustand) for state
- SVG for rendering

## Structure

```
src/
  utils/hex.js       Cube coordinate math: hexToPixel, hexNeighbors, hexRing…
  board/board.js     Board generation + vertex/edge data structures
  board/Board.jsx    The SVG board
  board/Hexagon.jsx  A single hex tile
  engine/store.js    Zustand store (board geometry + view toggles)
  ui/Controls.jsx    Overlay toggles + geometry readout
```

## Running

```sh
npm install
npm run dev
```

## Reference

[redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/) —
the definitive hex-grid guide. Read it before touching `utils/hex.js`.
