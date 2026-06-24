// Game event log — every action, in order, colour-coded by the acting player,
// auto-scrolling to the newest entry.

import { useEffect, useRef } from 'react';
import { useGameStore } from '../engine/store.js';

export default function Log() {
  const log = useGameStore((s) => s.game.log);
  const players = useGameStore((s) => s.game.players);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);

  return (
    <div className="log">
      <h2 className="panel__title">Game log</h2>
      <ul className="log__list">
        {log.map((e) => {
          const color = e.player != null ? players[e.player]?.color : null;
          return (
            <li key={e.id} className="log__item" style={{ borderLeftColor: color ?? 'transparent' }}>
              <span className="log__turn">T{e.turn}</span>
              <span className="log__text">{e.text}</span>
            </li>
          );
        })}
        <li ref={endRef} aria-hidden="true" className="log__end" />
      </ul>
    </div>
  );
}
