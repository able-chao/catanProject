// Player hands + victory points, plus the shared bank.

import { useGameStore } from '../engine/store.js';
import { RESOURCE_KEYS, RESOURCE_COLOR, RESOURCE_LABEL, handTotal } from '../engine/setup.js';

export default function Players() {
  const game = useGameStore((s) => s.game);

  return (
    <div className="players">
      <h2 className="panel__title">Players</h2>
      {game.players.map((p) => (
        <div key={p.id} className={`pcard${p.id === game.currentPlayer ? ' pcard--active' : ''}`}>
          <div className="pcard__head">
            <span className="pcard__chip" style={{ background: p.color }} />
            <span className="pcard__name">{p.name}</span>
            <span className="pcard__vp">{p.victoryPoints} VP</span>
          </div>
          <div className="pcard__hand">
            {RESOURCE_KEYS.map((r) => (
              <span className="res" key={r} title={RESOURCE_LABEL[r]}>
                <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
                {p.resources[r]}
              </span>
            ))}
            <span className="pcard__total">{handTotal(p.resources)}</span>
          </div>
        </div>
      ))}

      <div className="bank">
        <span className="bank__label">Bank</span>
        {RESOURCE_KEYS.map((r) => (
          <span className="res" key={r} title={RESOURCE_LABEL[r]}>
            <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
            {game.bank[r]}
          </span>
        ))}
      </div>
    </div>
  );
}
