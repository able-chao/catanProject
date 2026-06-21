// Phase 2 control panel: regenerate, resource legend, and live validation of
// the generated board (tile counts, the 6/8 rule, port count).

import { useGameStore } from '../engine/store.js';
import { validateBoard } from '../board/board.js';
import { RESOURCES, TILE_COUNTS } from '../board/tiles.js';

const TOGGLES = [
  { key: 'coords', label: 'Hex coordinates (q, r, s)' },
  { key: 'vertices', label: 'Vertices — settlement spots' },
  { key: 'edges', label: 'Edges — road spots' },
];

const LEGEND = ['forest', 'pasture', 'fields', 'mountains', 'hills', 'desert'];

export default function Controls() {
  const board = useGameStore((s) => s.board);
  const show = useGameStore((s) => s.show);
  const toggle = useGameStore((s) => s.toggle);
  const regenerate = useGameStore((s) => s.regenerate);

  const report = validateBoard(board);

  return (
    <aside className="panel">
      <button className="btn" onClick={regenerate}>
        ⟳ New board
      </button>

      <h2 className="panel__title">Terrain</h2>
      <ul className="legend">
        {LEGEND.map((terrain) => {
          const meta = RESOURCES[terrain];
          return (
            <li key={terrain} className="legend__row">
              <span className="legend__swatch" style={{ background: meta.color }} />
              <span className="legend__label">{meta.label}</span>
              <span className="legend__meta">{meta.resource}</span>
              <span className="legend__count">×{TILE_COUNTS[terrain]}</span>
            </li>
          );
        })}
      </ul>

      <h2 className="panel__title">Validation</h2>
      <ul className="checks">
        <Check ok={report.tileCountsOk} label="Tile counts (19)" />
        <Check ok={report.redAdjacencies === 0} label={`No adjacent 6/8 (${report.redAdjacencies})`} />
        <Check ok={report.portCount === 9} label={`9 ports placed (${report.portCount})`} />
      </ul>

      <h2 className="panel__title">Overlays</h2>
      <div className="panel__toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle">
            <input type="checkbox" checked={show[key]} onChange={() => toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <p className="panel__note">
        Phase 2 — Board Gen. Seed <code>{board.seed}</code>. Tokens placed in{' '}
        {board.tokenAttempts} attempt{board.tokenAttempts === 1 ? '' : 's'}.
      </p>
    </aside>
  );
}

function Check({ ok, label }) {
  return (
    <li className={`check${ok ? ' check--ok' : ' check--bad'}`}>
      <span className="check__mark">{ok ? '✓' : '✕'}</span>
      {label}
    </li>
  );
}
