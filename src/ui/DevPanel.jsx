// Development cards: buy, play, and resolve pending card effects (Year of
// Plenty / Monopoly pickers, Road Building banner).

import { useState } from 'react';
import { useGameStore } from '../engine/store.js';
import { PHASES } from '../engine/phases.js';
import { DEV, DEV_COST, DEV_LABEL, PLAYABLE_DEV } from '../engine/devcards.js';
import { RESOURCE_KEYS, RESOURCE_COLOR, RESOURCE_LABEL } from '../engine/setup.js';
import { hasBundle } from '../engine/trade.js';

const PLAY_ACTION = {
  [DEV.KNIGHT]: 'playKnight',
  [DEV.ROAD_BUILDING]: 'playRoadBuilding',
  [DEV.YEAR_OF_PLENTY]: 'playYearOfPlenty',
  [DEV.MONOPOLY]: 'playMonopoly',
};

export default function DevPanel() {
  const game = useGameStore((s) => s.game);
  const store = useGameStore();

  // Online: only the active player gets dev-card controls.
  if (store.mode === 'online' && game.currentPlayer !== store.mySeat) return null;

  // Pending resolutions take over the panel.
  if (game.pendingMonopoly) return <MonopolyPicker pick={store.pickMonopoly} />;
  if (game.pendingYearOfPlenty) return <YearOfPlentyPicker bank={game.bank} pick={store.pickYearOfPlenty} />;
  if (game.pendingRoadBuilding > 0) {
    return (
      <div className="devpanel">
        <h2 className="panel__title">Road Building</h2>
        <p className="hint">Place {game.pendingRoadBuilding} free road{game.pendingRoadBuilding > 1 ? 's' : ''} on the board.</p>
        <button className="btn btn--ghost btn--small" onClick={store.skipRoadBuilding}>Done</button>
      </div>
    );
  }

  if (game.phase !== PHASES.MAIN) return null;

  const me = game.players[game.currentPlayer];
  const canBuy = game.devDeck.length > 0 && hasBundle(me.resources, DEV_COST);
  const canPlay = !game.playedDevThisTurn && !game.pendingTrade;
  const playableCount = (type) => me.dev[type] - game.devBought[type];

  return (
    <div className="devpanel">
      <h2 className="panel__title">Development cards</h2>

      <div className="dev-buy">
        <button className="btn btn--small" disabled={!canBuy} onClick={store.buyDev}>Buy card</button>
        <span className="dev-cost">
          {RESOURCE_KEYS.filter((r) => DEV_COST[r]).map((r) => (
            <span key={r} className="res__dot" style={{ background: RESOURCE_COLOR[r] }} title={RESOURCE_LABEL[r]} />
          ))}
        </span>
        <span className="muted dev-deck">{game.devDeck.length} left</span>
      </div>

      <ul className="dev-hand">
        {Object.entries(me.dev).map(([type, n]) => {
          if (n === 0) return null;
          const isPlayable = PLAYABLE_DEV.includes(type);
          const ready = isPlayable && canPlay && playableCount(type) > 0;
          return (
            <li key={type} className="dev-card">
              <span className="dev-card__name">{DEV_LABEL[type]} ×{n}</span>
              {isPlayable ? (
                <button className="chip-btn" disabled={!ready} onClick={() => store[PLAY_ACTION[type]]()}>Play</button>
              ) : (
                <span className="muted">+1 VP</span>
              )}
            </li>
          );
        })}
        {Object.values(me.dev).every((n) => n === 0) && <li className="muted">No cards yet</li>}
      </ul>
      {game.playedDevThisTurn && <p className="muted dev-note">Card already played this turn.</p>}
    </div>
  );
}

function MonopolyPicker({ pick }) {
  return (
    <div className="devpanel">
      <h2 className="panel__title">Monopoly</h2>
      <p className="hint">Choose a resource to take from everyone:</p>
      <div className="res-picker">
        {RESOURCE_KEYS.map((r) => (
          <button key={r} className="res-btn" onClick={() => pick(r)} title={RESOURCE_LABEL[r]}>
            <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
            {RESOURCE_LABEL[r]}
          </button>
        ))}
      </div>
    </div>
  );
}

function YearOfPlentyPicker({ bank, pick }) {
  const [picks, setPicks] = useState([]);
  const add = (r) => picks.length < 2 && setPicks([...picks, r]);
  return (
    <div className="devpanel">
      <h2 className="panel__title">Year of Plenty</h2>
      <p className="hint">Pick 2 resources from the bank ({picks.length}/2):</p>
      <div className="res-picker">
        {RESOURCE_KEYS.map((r) => (
          <button key={r} className="res-btn" disabled={bank[r] <= 0 || picks.length >= 2} onClick={() => add(r)} title={RESOURCE_LABEL[r]}>
            <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
            {RESOURCE_LABEL[r]}
          </button>
        ))}
      </div>
      <p className="muted">Picked: {picks.map((r) => RESOURCE_LABEL[r]).join(' + ') || '—'}</p>
      <div className="row-gap">
        <button className="btn btn--small" disabled={picks.length !== 2} onClick={() => pick(picks)}>Take</button>
        <button className="btn btn--ghost btn--small" onClick={() => setPicks([])}>Reset</button>
      </div>
    </div>
  );
}
