// Phase 1 control panel: overlay toggles + a live readout of the geometry we
// generated. No gameplay — just a window into the data structures.

import { useGameStore } from '../engine/store.js';

const TOGGLES = [
  { key: 'coords', label: 'Hex coordinates (q, r, s)' },
  { key: 'vertices', label: 'Vertices — settlement spots' },
  { key: 'edges', label: 'Edges — road spots' },
];

export default function Controls() {
  const board = useGameStore((s) => s.board);
  const show = useGameStore((s) => s.show);
  const toggle = useGameStore((s) => s.toggle);

  return (
    <aside className="panel">
      <h2 className="panel__title">Overlays</h2>
      <div className="panel__toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle">
            <input
              type="checkbox"
              checked={show[key]}
              onChange={() => toggle(key)}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <h2 className="panel__title">Geometry</h2>
      <dl className="stats">
        <div>
          <dt>Hexes</dt>
          <dd>{board.hexes.length}</dd>
        </div>
        <div>
          <dt>Vertices</dt>
          <dd>{board.vertices.length}</dd>
        </div>
        <div>
          <dt>Edges</dt>
          <dd>{board.edges.length}</dd>
        </div>
      </dl>

      <p className="panel__note">
        Phase 1 — Foundation. Flat-top hex grid, cube coordinates, pre-computed
        settlement &amp; road spots. No game logic yet.
      </p>
    </aside>
  );
}
