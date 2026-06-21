// A single flat-top hex tile. Pure presentation — geometry comes pre-computed
// from board.js. No resources/numbers yet (that's Phase 2: Board Gen).

export default function Hexagon({ tile, showCoords }) {
  const points = tile.corners
    .map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');

  return (
    <g className="hex">
      <polygon className="hex__poly" points={points} />
      {showCoords && (
        <text
          className="hex__label"
          x={tile.center.x}
          y={tile.center.y}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {tile.q},{tile.r},{tile.s}
        </text>
      )}
    </g>
  );
}
