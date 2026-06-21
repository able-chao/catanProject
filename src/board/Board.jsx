// The interactive game board: terrain + tokens + ports (static), plus the live
// game layer — roads, settlements/cities, the robber, and click targets for
// setup placement and robber moves.

import { useGameStore } from '../engine/store.js';
import Hexagon from './Hexagon.jsx';
import { PHASES, isSetupPhase } from '../engine/phases.js';
import { validSettlementSpots, validRoadSpots } from '../engine/rules.js';

const lerp = (a, b, t) => a + (b - a) * t;

export default function Board() {
  const board = useGameStore((s) => s.board);
  const game = useGameStore((s) => s.game);
  const show = useGameStore((s) => s.show);
  const placeSettlement = useGameStore((s) => s.placeSettlement);
  const placeRoad = useGameStore((s) => s.placeRoad);
  const moveRobber = useGameStore((s) => s.moveRobber);

  const size = board.size;
  const { bounds } = board;
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;
  const hexes = [...board.hexes.values()];
  const ports = [...board.ports.values()];
  const colorOf = (pid) => game.players[pid].color;
  const current = game.players[game.currentPlayer];

  const setup = isSetupPhase(game.phase);
  const settlementSpots =
    setup && !game.awaitingRoad ? validSettlementSpots(game, board, { setup: true }) : [];
  const roadSpots =
    setup && game.awaitingRoad
      ? validRoadSpots(game, board, {
          setup: true,
          player: game.currentPlayer,
          settlementVertex: game.lastSettlement,
        })
      : [];
  const robberMode = game.phase === PHASES.MOVE_ROBBER;
  const robberHex = board.hexes.get(game.robberHex);

  return (
    <svg className="board" viewBox={viewBox} role="img" aria-label="Catan board">
      <rect
        className="board__sea"
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        rx={size * 0.5}
      />

      {/* Ports (static, Phase 2) */}
      <g className="board__ports">
        {ports.map((port) => {
          const va = board.vertices.get(port.vertexIds[0]);
          const vb = board.vertices.get(port.vertexIds[1]);
          return (
            <g className="port" key={port.id}>
              <title>{port.label}</title>
              <line className="port__link" x1={port.x} y1={port.y} x2={va.x} y2={va.y} />
              <line className="port__link" x1={port.x} y1={port.y} x2={vb.x} y2={vb.y} />
              <circle className="port__disc" cx={port.x} cy={port.y} r={size * 0.24} fill={port.color} />
              <text className="port__ratio" x={port.x} y={port.y} textAnchor="middle" dominantBaseline="central">
                {port.ratio}:1
              </text>
            </g>
          );
        })}
      </g>

      {/* Terrain + number tokens */}
      <g className="board__hexes">
        {hexes.map((tile) => (
          <Hexagon key={tile.id} tile={tile} showCoords={show.coords} />
        ))}
      </g>

      {/* Robber blocks its hex */}
      <polygon
        className="robber-block"
        points={robberHex.corners.map((c) => `${c.x},${c.y}`).join(' ')}
      />

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

      {/* Robber piece */}
      <g className="robber" transform={`translate(${robberHex.center.x - size * 0.46}, ${robberHex.center.y - size * 0.4})`}>
        <ellipse className="robber__body" cx={0} cy={size * 0.1} rx={size * 0.16} ry={size * 0.2} />
        <circle className="robber__head" cx={0} cy={-size * 0.12} r={size * 0.1} />
      </g>

      {/* --- Interactive layers --- */}

      {/* Robber move targets */}
      {robberMode &&
        hexes
          .filter((h) => h.id !== game.robberHex)
          .map((h) => (
            <polygon
              key={`rt-${h.id}`}
              className="robber-target"
              points={h.corners.map((c) => `${c.x},${c.y}`).join(' ')}
              onClick={() => moveRobber(h.id)}
            />
          ))}

      {/* Valid settlement spots */}
      {settlementSpots.map((vid) => {
        const v = board.vertices.get(vid);
        return (
          <circle
            key={`ss-${vid}`}
            className="spot spot--settlement"
            cx={v.x}
            cy={v.y}
            r={size * 0.17}
            fill={current.color}
            onClick={() => placeSettlement(vid)}
          />
        );
      })}

      {/* Valid road spots */}
      {roadSpots.map((eid) => {
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
            onClick={() => placeRoad(eid)}
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
  );
}

function Building({ x, y, color, type, size }) {
  const k = size * (type === 'city' ? 0.3 : 0.22);
  // Simple house silhouette, centred on the vertex.
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
        <rect
          className="building__poly"
          x={x - 0.7 * k}
          y={y + 0.2 * k}
          width={1.4 * k}
          height={0.6 * k}
          fill={color}
        />
      )}
    </g>
  );
}
