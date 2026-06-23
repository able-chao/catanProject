// Player HUD: VP total + special-card badges, hand (your own cards in detail,
// opponents as a hidden count), dev cards, knights, and pieces left in supply.

import { useGameStore } from '../engine/store.js';
import { RESOURCE_KEYS, RESOURCE_COLOR, RESOURCE_LABEL, handTotal, totalVictoryPoints } from '../engine/setup.js';
import { SUPPLY_LIMITS } from '../engine/building.js';

const devTotal = (dev) => Object.values(dev).reduce((s, n) => s + n, 0);

export default function Players() {
  const game = useGameStore((s) => s.game);

  return (
    <div className="players">
      <h2 className="panel__title">Players</h2>
      {game.players.map((p) => {
        const owner = p.id === game.currentPlayer; // you only see your own cards
        return (
          <div key={p.id} className={`pcard${owner ? ' pcard--active' : ''}`} style={{ '--pc': p.color }}>
            <div className="pcard__head">
              <span className="pcard__chip" style={{ background: p.color }} />
              <span className="pcard__name">{p.name}</span>
              <span className="pcard__badges">
                {game.largestArmy === p.id && <span className="badge" title="Largest Army (+2)">⚔</span>}
                {game.longestRoad === p.id && <span className="badge" title="Longest Road (+2)">🛣</span>}
              </span>
              <span className="pcard__vp">{totalVictoryPoints(game, p.id)} VP</span>
            </div>

            {owner ? (
              <div className="pcard__hand">
                {RESOURCE_KEYS.map((r) => (
                  <span className="res" key={r} title={RESOURCE_LABEL[r]}>
                    <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
                    {p.resources[r]}
                  </span>
                ))}
                <span className="pcard__total">{handTotal(p.resources)}</span>
              </div>
            ) : (
              <div className="pcard__hand pcard__hand--hidden">
                <span className="cardback">🂠</span>
                {handTotal(p.resources)} cards
              </div>
            )}

            <div className="pcard__meta">
              <span title="Development cards">🎴 {devTotal(p.dev)}</span>
              <span title="Knights played">⚔ {p.knightsPlayed}</span>
              <span title="Pieces left — settlements · cities · roads">
                🛖 {SUPPLY_LIMITS.settlements - p.settlements} · 🏙 {SUPPLY_LIMITS.cities - p.cities} · 🛣 {SUPPLY_LIMITS.roads - p.roads}
              </span>
            </div>
          </div>
        );
      })}

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
