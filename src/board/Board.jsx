// The SVG board: 19 flat-top hexes plus optional vertex/edge overlays that
// visualise the pre-computed settlement and road spots.

import { useGameStore } from '../engine/store.js';
import Hexagon from './Hexagon.jsx';

export default function Board() {
  const board = useGameStore((s) => s.board);
  const show = useGameStore((s) => s.show);

  const { bounds, hexes, vertices, edges } = board;
  const viewBox = `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`;

  return (
    <svg
      className="board"
      viewBox={viewBox}
      role="img"
      aria-label="Catan board — 19 hexes"
    >
      {/* Ocean frame */}
      <rect
        className="board__sea"
        x={bounds.minX}
        y={bounds.minY}
        width={bounds.width}
        height={bounds.height}
        rx={board.size * 0.5}
      />

      {/* Land tiles */}
      <g className="board__hexes">
        {hexes.map((tile) => (
          <Hexagon key={tile.id} tile={tile} showCoords={show.coords} />
        ))}
      </g>

      {/* Road spots */}
      {show.edges && (
        <g className="board__edges">
          {edges.map((e) => (
            <line
              key={e.id}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              className="edge"
            />
          ))}
        </g>
      )}

      {/* Settlement spots */}
      {show.vertices && (
        <g className="board__vertices">
          {vertices.map((v) => (
            <circle
              key={v.id}
              cx={v.x}
              cy={v.y}
              r={board.size * 0.11}
              className="vertex"
            />
          ))}
        </g>
      )}
    </svg>
  );
}
