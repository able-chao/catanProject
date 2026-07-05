# Catan

A from-scratch **Catan** clone — hex-grid board, full game rules, trading and
development cards, and real-time online multiplayer. Built with React + SVG and
a pure, server-authoritative game engine.

Built in 7 phases — all complete:

| Phase | Focus | |
| ----- | ----- | -- |
| **1. Foundation** | Hex math, cube coordinates, SVG grid rendering | ✅ |
| **2. Board Gen** | Terrain shuffle, number tokens, ports | ✅ |
| **3. Game Engine** | Turn state machine, dice, resource distribution, robber | ✅ |
| **4. Building** | Roads, settlements, cities with full rule enforcement | ✅ |
| **5. Trading** | Bank/port & player trades, dev cards, Largest Army, Longest Road | ✅ |
| **6. UI & Polish** | Player HUDs, color-coded log, animations, win screen | ✅ |
| **7. Multiplayer** | Real-time networked play via Socket.io | ✅ |

## Maps

Five maps, all defined as data (and ASCII art) in `src/board/maps.js`. Local
play picks the map on the home screen; online, **the host selects the map in
the lobby** (locked once the game starts).

| Map | Size | Twist |
| --- | ---- | ----- |
| **Classic** | 19 hexes · 9 ports | The standard board: 1 desert, tokens A–R. |
| **Diamond** | 24 hexes · 9 ports | A leaning rhombus with a **lake** — a non-producing water tile where the robber starts. |
| **USA** | 144 hexes · 25 ports | The continental United States, coast to coast — every port kind including 2:1 brick. |
| **Volcano** | 75 hexes · 11 ports | **Fog of war**: an X of clouds hides the island's heart. A road touching a fog tile reveals it. The visible **gold field** at the centre pays resources **of your choice** (2 for a city). |
| **Earth** | 81 hexes · 27 ports | The world as **7 islands**. Roads can't cross water — claim a second continent with your other starting settlement. |
| **Black Forest** | 55 hexes · 9 ports | Deep woods around a lagoon: the visible world is almost all **forest**, every other resource hides in the **fog** frontier. Ports ring the lagoon, and the **gold isle** at the centre can only be claimed during setup. |

## Game options

- **Friendly robber** — while a player has fewer than 3 victory points, the
  robber cannot be placed on any hex touching their buildings; once they reach
  3 VP the protection lifts. (If every hex is protected — e.g. right after
  setup — the rule relaxes so the robber always has somewhere to go.) Toggle it
  on the home screen for local games; online, the host sets it in the lobby.

## Features

- **Zoom & pan** on every board — scroll (or the +/− buttons) to zoom around
  the cursor, drag to pan, ⤢ to fit. Essential on the big maps; a drag never
  triggers an accidental build.
- Flat-top hexagons on cube coordinates, with number tokens (no two red 6/8
  adjacent) and ports generated for any map shape.
- Full rules: snake-draft setup, 2d6 production with bank-low handling, the
  robber (discard-on-7, move, steal), building with costs & supply limits, city
  upgrades, bank/port/player trading, the 25-card dev deck, **Largest Army** and
  **Longest Road** (a DFS over road edges).
- **Win detection** at 10 VP with an itemized victory-point breakdown.
- **Two ways to play:**
  - **Local** hotseat (one screen, pass-and-play).
  - **Online** — create/join a room, ready up, and play in real time.

## Stack

- [Vite](https://vite.dev/) + React (JavaScript)
- [Zustand](https://github.com/pmndrs/zustand) for client state
- [Framer Motion](https://www.framer.com/motion/) for animation
- SVG for all board rendering
- [Socket.io](https://socket.io/) for multiplayer (Node server)

## Running

Install dependencies once:

```sh
npm install
```

### Local game

```sh
npm run dev
```

Open the printed URL (default **http://localhost:5173**) and pick **3** or
**4 players** under *Local game*.

### Online multiplayer

Multiplayer needs the game server running **in addition to** the dev server, so
use two terminals:

```sh
# Terminal 1 — game server (WebSockets, port 3001)
npm run server

# Terminal 2 — web client
npm run dev
```

Then, in the browser:

1. Open **http://localhost:5173** in one tab → enter a name → **Create room**.
2. Share the 4-letter room code; open another tab (or another machine) →
   enter a name + the code → **Join**.
3. Each player picks a colour and clicks **Ready up**; the host clicks
   **Start game**.

By default the client connects to `http://localhost:3001`. To point at a
different host, set `VITE_SERVER_URL` when building/serving the client
(e.g. `VITE_SERVER_URL=https://my-server npm run dev`).

> The server keeps games in memory (rooms survive reconnects while it runs).
> Game state is plain JSON, so swapping the in-memory store for Redis/a database
> is a drop-in change.

## Scripts

| Command | What it does |
| ------- | ------------ |
| `npm run dev` | Vite dev server (web client) |
| `npm run server` | Socket.io game server on port 3001 |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint |

## Tests

Headless tests live in `scripts/` (plain Node, no test runner):

```sh
node scripts/stress-test.mjs       # 10k random boards satisfy all constraints
node scripts/longest-road.test.mjs # Longest Road DFS unit tests
node scripts/phase5.test.mjs       # trading + dev-card feature tests
node scripts/engine-sim.mjs        # full games; checks invariants (conservation, etc.)
node scripts/net-test.mjs          # two-client multiplayer test (run `npm run server` first)
```

## Project structure

```
server/index.js        Socket.io server — authoritative engine, rooms, lobby, reconnection
src/
  utils/               hex math (cube coords) + seeded RNG
  board/               map registry (maps.js) + board generation + SVG components
  engine/              the pure game core:
    reducer.js           gameReducer(state, action, board) — one snapshot per action
    rules.js building.js  placement rules + costs/supply + valid-placement precompute
    trade.js devcards.js longestRoad.js distribution.js
    enrich.js            server-authoritative randomness (dice / steal)
    store.js             Zustand store (local + online modes)
  ui/                  HUD, log, trade/dev panels, lobby, chat, win screen
  net/socket.js        client socket layer
scripts/               headless tests
```

## Architecture notes

- **Pure engine.** `gameReducer(state, action, board)` has no UI imports and
  returns a brand-new immutable snapshot per action — which is what makes undo,
  replay and multiplayer sync fall out for free. The same engine runs in the
  browser (local play) and on the Node server (online play).
- **Flat, serializable state.** Hexes/vertices/edges/buildings/roads are flat
  maps/objects keyed by id, so the whole game state is plain JSON.
- **Maps are data.** A map is just axial coordinates + a tile bag + a token
  pool; the generator is shape-agnostic. Boards never travel over the network —
  clients rebuild them deterministically from `(mapId, seed)`.
- **Server-authoritative.** Online, clients send *bare* action intents; the
  server validates them and **generates the dice itself** — a client can never
  tell the server what it rolled.

## Reference

[redblobgames.com/grids/hexagons](https://www.redblobgames.com/grids/hexagons/) —
the definitive hex-grid guide. Read it before touching `src/utils/hex.js`.
