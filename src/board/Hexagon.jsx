// A single flat-top hex tile: terrain fill + number token — or a fog cloud
// when the tile hasn't been explored yet (terrain and token stay hidden).

import { RESOURCES } from './tiles.js';

export default function Hexagon({ tile, showCoords, fogged }) {
  const points = tile.corners
    .map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`)
    .join(' ');
  const meta = RESOURCES[tile.resource] ?? RESOURCES.desert;
  const { center } = tile;

  if (fogged) {
    return (
      <g className="hex hex--fog">
        <title>Unexplored — build a road up to it to reveal it</title>
        <polygon className="hex__poly hex__poly--fog" points={points} />
        <g className="fog-puffs">
          <ellipse cx={center.x - 13} cy={center.y + 4} rx={13} ry={9} />
          <ellipse cx={center.x + 12} cy={center.y + 5} rx={12} ry={8} />
          <ellipse cx={center.x} cy={center.y - 6} rx={15} ry={10} />
        </g>
      </g>
    );
  }

  return (
    <g className="hex">
      <polygon
        className="hex__poly"
        points={points}
        fill={meta.color}
      />

      {showCoords && (
        <text
          className="hex__coords"
          x={center.x}
          y={center.y - (tile.token ? 0 : 0)}
          dy={tile.token ? '2.4em' : 0}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {tile.q},{tile.r},{tile.s}
        </text>
      )}

      {tile.token && <NumberToken token={tile.token} cx={center.x} cy={center.y} />}
    </g>
  );
}

function NumberToken({ token, cx, cy }) {
  const r = 18;
  const pipR = 1.7;
  const gap = 5;
  const totalWidth = (token.pips - 1) * gap;
  const start = cx - totalWidth / 2;

  return (
    <g className="token">
      <title>
        {token.letter} · rolls {token.number}
      </title>
      <circle className="token__disc" cx={cx} cy={cy} r={r} />
      <text
        className={`token__num${token.red ? ' token__num--red' : ''}`}
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        dominantBaseline="central"
      >
        {token.number}
      </text>
      <g className={`token__pips${token.red ? ' token__pips--red' : ''}`}>
        {Array.from({ length: token.pips }).map((_, i) => (
          <circle key={i} cx={start + i * gap} cy={cy + 9} r={pipR} />
        ))}
      </g>
    </g>
  );
}
