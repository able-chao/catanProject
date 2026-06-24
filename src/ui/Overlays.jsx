// New-game controls + dev overlay toggles.

import { useGameStore } from '../engine/store.js';

const TOGGLES = [
  { key: 'coords', label: 'Hex coordinates' },
  { key: 'vertices', label: 'Vertices' },
  { key: 'edges', label: 'Edges' },
];

export default function Overlays() {
  const show = useGameStore((s) => s.show);
  const toggle = useGameStore((s) => s.toggle);
  const newGame = useGameStore((s) => s.newGame);
  const mode = useGameStore((s) => s.mode);
  const playerCount = useGameStore((s) => s.game.players.length);

  return (
    <div className="overlays">
      {mode === 'local' && (
        <>
          <h2 className="panel__title">New game</h2>
          <div className="newgame">
            <span className="newgame__label">Players</span>
            {[3, 4].map((n) => (
              <button
                key={n}
                className={`pill${n === playerCount ? ' pill--on' : ''}`}
                onClick={() => newGame(n)}
              >
                {n}
              </button>
            ))}
            <button className="btn btn--ghost btn--small" onClick={() => newGame()}>
              ⟳ New
            </button>
          </div>
        </>
      )}

      <h2 className="panel__title">Overlays</h2>
      <div className="panel__toggles">
        {TOGGLES.map(({ key, label }) => (
          <label key={key} className="toggle">
            <input type="checkbox" checked={show[key]} onChange={() => toggle(key)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
