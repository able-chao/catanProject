// Event log — the running narrative produced by the reducer.

import { useGameStore } from '../engine/store.js';

export default function Log() {
  const log = useGameStore((s) => s.game.log);
  const recent = [...log].slice(-14).reverse();

  return (
    <div className="log">
      <h2 className="panel__title">Log</h2>
      <ul className="log__list">
        {recent.map((e) => (
          <li key={e.id}>
            <span className="log__turn">T{e.turn}</span>
            {e.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
