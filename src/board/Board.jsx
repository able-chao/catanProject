// The interactive game board: terrain + tokens + ports (static), plus the live
// game layer — roads, settlements/cities, the robber, and click targets.
//
// Placement highlights come straight from the precomputed `game.valid` cache
// (built once per state change in the reducer). The board never re-validates.
//
// A viewBox "camera" provides zoom & pan on every map: wheel (or the +/−
// buttons) zooms around the cursor, dragging the board pans. A real click and
// a pan are disambiguated by a small movement threshold — if the pointer
// travelled, the following click is swallowed so you never build by accident.

import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../engine/store.js';
import Hexagon from './Hexagon.jsx';
import { PHASES, isSetupPhase } from '../engine/phases.js';
import { validRobberHexes } from '../engine/rules.js';

const lerp = (a, b, t) => a + (b - a) * t;
const EMPTY = { settlements: [], roads: [], cities: [] };

const MAX_ZOOM = 8;
const PAN_THRESHOLD_PX = 5;

/** Screen (client) coords -> SVG user coords under the current viewBox. */
function toSvgPoint(svg, clientX, clientY) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

/** Keep the camera inside the board and between 1× and MAX_ZOOM×. */
function clampView(v, fit) {
  const w = Math.min(Math.max(v.w, fit.w / MAX_ZOOM), fit.w);
  const h = w * (fit.h / fit.w);
  return {
    x: Math.min(Math.max(v.x, fit.x), fit.x + fit.w - w),
    y: Math.min(Math.max(v.y, fit.y), fit.y + fit.h - h),
    w,
    h,
  };
}

/** Zoom by factor k, keeping the SVG point (cx, cy) fixed on screen. */
function zoomView(v, fit, k, cx, cy) {
  return clampView(
    { x: cx - (cx - v.x) / k, y: cy - (cy - v.y) / k, w: v.w / k, h: v.h / k },
    fit,
  );
}

export default function Board() {
  const board = useGameStore((s) => s.board);
  const game = useGameStore((s) => s.game);
  const show = useGameStore((s) => s.show);
  const placeSettlement = useGameStore((s) => s.placeSettlement);
  const placeRoad = useGameStore((s) => s.placeRoad);
  const buildSettlement = useGameStore((s) => s.buildSettlement);
  const buildRoad = useGameStore((s) => s.buildRoad);
  const buildCity = useGameStore((s) => s.buildCity);
  const placeFreeRoad = useGameStore((s) => s.placeFreeRoad);
  const moveRobber = useGameStore((s) => s.moveRobber);
  const mode = useGameStore((s) => s.mode);
  const mySeat = useGameStore((s) => s.mySeat);

  const size = board.size;
  const { bounds } = board;
  const fit = { x: bounds.minX, y: bounds.minY, w: bounds.width, h: bounds.height };
  const hexes = [...board.hexes.values()];
  const ports = [...board.ports.values()];
  const colorOf = (pid) => game.players[pid].color;
  const current = game.players[game.currentPlayer];

  const setup = isSetupPhase(game.phase);
  const valid = game.valid ?? EMPTY;
  // Online: you may only interact on your own turn.
  const canAct = mode === 'local' || game.currentPlayer === mySeat;
  const robberMode = game.phase === PHASES.MOVE_ROBBER;
  const canRobber = robberMode && canAct;
  const robberHex = board.hexes.get(game.robberHex);
  // Legal robber destinations (excludes fog and friendly-robber-protected hexes).
  const robberSpots = canRobber ? new Set(validRobberHexes(game, board)) : null;

  const svgRef = useRef(null);

  // --- Camera (zoom & pan) ---------------------------------------------------
  // View state is keyed to the board so a new game/map starts fitted; null
  // means "fit the whole board".
  const [camera, setCamera] = useState({ board: null, view: null });
  const view = camera.board === board ? camera.view : null;
  const vb = view ?? fit;
  const zoomed = vb.w < fit.w - 0.5;
  const setView = (next) =>
    setCamera((c) => ({
      board,
      view: typeof next === 'function' ? next(c.board === board ? c.view : null) : next,
    }));

  const zoomButtons = (k) =>
    setView((v0) => {
      const v = v0 ?? fit;
      return zoomView(v, fit, k, v.x + v.w / 2, v.y + v.h / 2);
    });

  // Wheel zoom needs a NON-passive listener (React's synthetic wheel can't
  // preventDefault), so attach natively per board.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const fitBox = {
      x: board.bounds.minX,
      y: board.bounds.minY,
      w: board.bounds.width,
      h: board.bounds.height,
    };
    const onWheel = (e) => {
      e.preventDefault();
      const k = Math.exp(-e.deltaY * 0.002);
      const p = toSvgPoint(svg, e.clientX, e.clientY);
      setCamera((c) => {
        const v = (c.board === board ? c.view : null) ?? fitBox;
        return { board, view: zoomView(v, fitBox, k, p.x, p.y) };
      });
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [board]);

  // Drag-to-pan. Starts on any pointer press that isn't the draggable robber;
  // becomes a pan only after PAN_THRESHOLD_PX, and then swallows the click.
  const panRef = useRef(null);
  const suppressClickRef = useRef(false);

  const onPanDown = (e) => {
    if (e.target.closest?.('.robber--draggable')) return; // robber owns its drag
    panRef.current = { px: e.clientX, py: e.clientY, view0: vb, panned: false, id: e.pointerId };
  };
  const onPanMove = (e) => {
    const p = panRef.current;
    if (!p) return;
    if (e.buttons === 0) { panRef.current = null; return; } // button released off-board
    const dx = e.clientX - p.px;
    const dy = e.clientY - p.py;
    if (!p.panned) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD_PX) return;
      p.panned = true;
      svgRef.current.setPointerCapture?.(p.id);
    }
    const scale = p.view0.w / svgRef.current.getBoundingClientRect().width;
    setView(
      clampView(
        { x: p.view0.x - dx * scale, y: p.view0.y - dy * scale, w: p.view0.w, h: p.view0.h },
        fit,
      ),
    );
  };
  const onPanUp = () => {
    suppressClickRef.current = Boolean(panRef.current?.panned);
    panRef.current = null;
  };
  const onClickCapture = (e) => {
    if (suppressClickRef.current) {
      e.stopPropagation();
      suppressClickRef.current = false;
    }
  };

  // --- Robber drag (snaps to the nearest hex centre on release) --------------
  const [drag, setDrag] = useState(null);
  const toSvg = (e) => toSvgPoint(svgRef.current, e.clientX, e.clientY);
  const nearestHex = (x, y) => {
    let best = null;
    let bestD = Infinity;
    for (const h of hexes) {
      if (!robberSpots?.has(h.id)) continue; // only snap to legal destinations
      const d = (h.center.x - x) ** 2 + (h.center.y - y) ** 2;
      if (d < bestD) { bestD = d; best = h; }
    }
    return best;
  };

  // Setup placements are free; BUILD placements cost resources; Road Building
  // dev card places free roads.
  const onSettlement = setup ? placeSettlement : buildSettlement;
  const onRoad = game.pendingRoadBuilding > 0 ? placeFreeRoad : setup ? placeRoad : buildRoad;

  return (
    <div className="board-wrap">
      <svg
        ref={svgRef}
        className={`board${zoomed ? ' board--zoomed' : ''}`}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        role="img"
        aria-label="Catan board"
        onPointerDown={onPanDown}
        onPointerMove={onPanMove}
        onPointerUp={onPanUp}
        onPointerCancel={onPanUp}
        onClickCapture={onClickCapture}
      >
      <rect className="board__sea" x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} rx={size * 0.5} />

      {/* Ports (static, Phase 2) */}
      <g className="board__ports">
        {ports.map((port) => {
          const va = board.vertices.get(port.vertexIds[0]);
          const vb2 = board.vertices.get(port.vertexIds[1]);
          return (
            <g className="port" key={port.id}>
              <title>{port.label}</title>
              <line className="port__link" x1={port.x} y1={port.y} x2={va.x} y2={va.y} />
              <line className="port__link" x1={port.x} y1={port.y} x2={vb2.x} y2={vb2.y} />
              <circle className="port__disc" cx={port.x} cy={port.y} r={size * 0.24} fill={port.color} />
              <text className="port__ratio" x={port.x} y={port.y} textAnchor="middle" dominantBaseline="central">
                {port.ratio}:1
              </text>
            </g>
          );
        })}
      </g>

      {/* Terrain + number tokens (fog hides unexplored tiles) */}
      <g className="board__hexes">
        {hexes.map((tile) => (
          <Hexagon key={tile.id} tile={tile} showCoords={show.coords} fogged={Boolean(game.fog?.[tile.id])} />
        ))}
      </g>

      <polygon className="robber-block" points={robberHex.corners.map((c) => `${c.x},${c.y}`).join(' ')} />

      {/* Roads */}
      <g className="board__roads">
        {Object.entries(game.roads).map(([edgeId, pid]) => {
          const e = board.edges.get(edgeId);
          const x1 = lerp(e.x1, e.x2, 0.16);
          const y1 = lerp(e.y1, e.y2, 0.16);
          const x2 = lerp(e.x2, e.x1, 0.16);
          const y2 = lerp(e.y2, e.y1, 0.16);
          return (
            <g key={edgeId}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="road road--shadow" strokeWidth={size * 0.18} />
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="road" stroke={colorOf(pid)} strokeWidth={size * 0.12} />
            </g>
          );
        })}
      </g>

      {/* Settlements & cities */}
      <g className="board__buildings">
        {Object.entries(game.buildings).map(([vertexId, b]) => {
          const v = board.vertices.get(vertexId);
          return <Building key={vertexId} x={v.x} y={v.y} color={colorOf(b.player)} type={b.type} size={size} />;
        })}
      </g>

      {/* Robber piece — draggable during MOVE_ROBBER */}
      <g
        className={`robber${canRobber ? ' robber--draggable' : ''}`}
        transform={
          drag
            ? `translate(${drag.x}, ${drag.y})`
            : `translate(${robberHex.center.x - size * 0.46}, ${robberHex.center.y - size * 0.4})`
        }
        onPointerDown={
          canRobber
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                const p = toSvg(e);
                setDrag({ x: p.x, y: p.y });
              }
            : undefined
        }
        onPointerMove={drag ? (e) => { const p = toSvg(e); setDrag({ x: p.x, y: p.y }); } : undefined}
        onPointerUp={
          drag
            ? (e) => {
                const p = toSvg(e);
                const h = nearestHex(p.x, p.y);
                setDrag(null);
                if (h) moveRobber(h.id);
              }
            : undefined
        }
      >
        <ellipse className="robber__body" cx={0} cy={size * 0.1} rx={size * 0.16} ry={size * 0.2} />
        <circle className="robber__head" cx={0} cy={-size * 0.12} r={size * 0.1} />
      </g>

      {/* --- Interactive layers (from precomputed game.valid) --- */}

      {canRobber &&
        hexes
          .filter((h) => robberSpots.has(h.id))
          .map((h) => (
            <polygon
              key={`rt-${h.id}`}
              className="robber-target"
              points={h.corners.map((c) => `${c.x},${c.y}`).join(' ')}
              onClick={() => moveRobber(h.id)}
            />
          ))}

      {/* City upgrade spots (own settlements) */}
      {canAct && valid.cities.map((vid) => {
        const v = board.vertices.get(vid);
        return (
          <circle
            key={`city-${vid}`}
            className="spot spot--city"
            cx={v.x}
            cy={v.y}
            r={size * 0.3}
            stroke={current.color}
            onClick={() => buildCity(vid)}
          />
        );
      })}

      {/* Settlement spots */}
      {canAct && valid.settlements.map((vid) => {
        const v = board.vertices.get(vid);
        return (
          <circle
            key={`ss-${vid}`}
            className="spot spot--settlement"
            cx={v.x}
            cy={v.y}
            r={size * 0.17}
            fill={current.color}
            onClick={() => onSettlement(vid)}
          />
        );
      })}

      {/* Road spots */}
      {canAct && valid.roads.map((eid) => {
        const e = board.edges.get(eid);
        return (
          <line
            key={`rs-${eid}`}
            className="spot spot--road"
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={current.color}
            strokeWidth={size * 0.13}
            onClick={() => onRoad(eid)}
          />
        );
      })}

      {/* Dev overlays */}
      {show.edges && (
        <g className="board__edges">
          {[...board.edges.values()].map((e) => (
            <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className={`edge${e.coastal ? ' edge--coastal' : ''}`} />
          ))}
        </g>
      )}
      {show.vertices && (
        <g className="board__vertices">
          {[...board.vertices.values()].map((v) => (
            <circle key={v.id} cx={v.x} cy={v.y} r={size * 0.08} className={`vertex${v.coastal ? ' vertex--coastal' : ''}`} />
          ))}
        </g>
      )}
      </svg>

      {/* Camera controls */}
      <div className="board-zoom">
        <span className="board-zoom__level">{(fit.w / vb.w).toFixed(1)}×</span>
        <button className="chip-btn" title="Zoom in" onClick={() => zoomButtons(1.5)}>＋</button>
        <button className="chip-btn" title="Zoom out" disabled={!zoomed} onClick={() => zoomButtons(1 / 1.5)}>−</button>
        <button className="chip-btn" title="Fit board" disabled={!zoomed} onClick={() => setView(null)}>⤢</button>
      </div>
    </div>
  );
}

function Building({ x, y, color, type, size }) {
  const k = size * (type === 'city' ? 0.3 : 0.22);
  const house = [
    [-0.7 * k, 0.8 * k],
    [-0.7 * k, -0.15 * k],
    [0, -0.85 * k],
    [0.7 * k, -0.15 * k],
    [0.7 * k, 0.8 * k],
  ]
    .map(([dx, dy]) => `${(x + dx).toFixed(2)},${(y + dy).toFixed(2)}`)
    .join(' ');

  return (
    <g className="building">
      <polygon points={house} fill={color} className="building__poly" />
      {type === 'city' && (
        <rect className="building__poly" x={x - 0.7 * k} y={y + 0.2 * k} width={1.4 * k} height={0.6 * k} fill={color} />
      )}
    </g>
  );
}
