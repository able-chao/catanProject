// The SVG board: terrain hexes + number tokens + ports, with optional dev
// overlays (coords / vertices / edges). Reads everything from the flat maps.

import { useGameStore } from '../engine/store.js';
import Hexagon from './Hexagon.jsx';

export default function Board() {
  const board = useGameStore((s) => s.board);
  const show = useGameStore((s) => s.show);

  const { bounds } = board;
  const hexes = [...board.hexes.values()];
  const vertices = [...board.vertices.values()];
  const edges = [...board.edges.values()];
  const ports = [...board.ports.values()];
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;

  return (
    <svg className="board" viewBox={viewBox} role="img" aria-label="Catan board">
      {/* Ocean frame */}
      <rect
        className="board__sea"
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        rx={board.size * 0.5}
      />

      {/* Ports sit under the land so their access lines tuck beneath the tiles */}
      <g className="board__ports">
        {ports.map((port) => {
          const va = board.vertices.get(port.vertexIds[0]);
          const vb = board.vertices.get(port.vertexIds[1]);
          return (
            <g className="port" key={port.id}>
              <title>{port.label}</title>
              <line className="port__link" x1={port.x} y1={port.y} x2={va.x} y2={va.y} />
              <line className="port__link" x1={port.x} y1={port.y} x2={vb.x} y2={vb.y} />
              <circle className="port__disc" cx={port.x} cy={port.y} r={board.size * 0.26} fill={port.color} />
              <text className="port__ratio" x={port.x} y={port.y} textAnchor="middle" dominantBaseline="central">
                {port.ratio}:1
              </text>
            </g>
          );
        })}
      </g>

      {/* Land tiles + tokens */}
      <g className="board__hexes">
        {hexes.map((tile) => (
          <Hexagon key={tile.id} tile={tile} showCoords={show.coords} />
        ))}
      </g>

      {/* Dev overlay: road spots */}
      {show.edges && (
        <g className="board__edges">
          {edges.map((e) => (
            <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} className={`edge${e.coastal ? ' edge--coastal' : ''}`} />
          ))}
        </g>
      )}

      {/* Dev overlay: settlement spots */}
      {show.vertices && (
        <g className="board__vertices">
          {vertices.map((v) => (
            <circle key={v.id} cx={v.x} cy={v.y} r={board.size * 0.1} className={`vertex${v.coastal ? ' vertex--coastal' : ''}`} />
          ))}
        </g>
      )}
    </svg>
  );
}
