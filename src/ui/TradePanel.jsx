// Trading UI (MAIN phase): bank/port trades + player-to-player offers.
// Works in local hotseat (one person drives everyone) and online (the active
// player proposes; other players accept/decline from their own clients).

import { useState } from 'react';
import { useGameStore } from '../engine/store.js';
import { PHASES } from '../engine/phases.js';
import { RESOURCE_KEYS, RESOURCE_COLOR, RESOURCE_LABEL } from '../engine/setup.js';
import { tradeRates, bundleTotal, hasBundle } from '../engine/trade.js';

const clean = (b) => Object.fromEntries(RESOURCE_KEYS.filter((r) => (b[r] ?? 0) > 0).map((r) => [r, b[r]]));
const fmt = (b) => {
  const parts = RESOURCE_KEYS.filter((r) => b[r] > 0).map((r) => `${b[r]} ${RESOURCE_LABEL[r]}`);
  return parts.length ? parts.join(', ') : 'nothing';
};

export default function TradePanel() {
  const game = useGameStore((s) => s.game);
  const board = useGameStore((s) => s.board);
  const mode = useGameStore((s) => s.mode);
  const mySeat = useGameStore((s) => s.mySeat);
  const bankTrade = useGameStore((s) => s.bankTrade);
  const proposeTrade = useGameStore((s) => s.proposeTrade);
  const acceptTrade = useGameStore((s) => s.acceptTrade);
  const declineTrade = useGameStore((s) => s.declineTrade);
  const cancelTrade = useGameStore((s) => s.cancelTrade);

  const [give, setGive] = useState({});
  const [want, setWant] = useState({});
  const [counterFor, setCounterFor] = useState(null);
  const [cGive, setCGive] = useState({});
  const [cWant, setCWant] = useState({});

  const busy = game.pendingRoadBuilding > 0 || game.pendingYearOfPlenty || game.pendingMonopoly;
  if (game.phase !== PHASES.MAIN || busy) return null;

  const cp = game.currentPlayer;
  const me = game.players[cp];
  const rates = tradeRates(game, board, cp);
  const t = game.pendingTrade;
  const others = game.players.filter((p) => p.id !== cp);

  const canAct = mode === 'local' || cp === mySeat;
  const amResponder = mode === 'online' && t && t.from !== mySeat && (t.to == null || t.to === mySeat);
  if (mode === 'online' && !canAct && !amResponder) return null;

  return (
    <div className="tradepanel">
      {canAct && (
        <>
          <h2 className="panel__title">Bank / Port</h2>
          <div className="bank-trades">
            {RESOURCE_KEYS.map((r) => (
              <BankRow key={r} give={r} rate={rates[r]} have={me.resources[r]} bank={game.bank} onTrade={bankTrade} />
            ))}
          </div>

          <h2 className="panel__title">Player trade</h2>
          {!t && (
            <>
              <BundleEditor label="You give" bundle={give} setBundle={setGive} max={me.resources} />
              <BundleEditor label="You want" bundle={want} setBundle={setWant} />
              <button
                className="btn"
                disabled={bundleTotal(give) + bundleTotal(want) === 0 || !hasBundle(me.resources, clean(give))}
                onClick={() => {
                  proposeTrade({ from: cp, to: null, give: clean(give), want: clean(want) });
                  setGive({});
                  setWant({});
                }}
              >
                Propose offer
              </button>
            </>
          )}
        </>
      )}

      {t && (
        <div className="offer">
          {!canAct && <h2 className="panel__title">Trade offer</h2>}
          <p className="offer__terms">
            {game.players[t.from].name} gives <b>{fmt(t.give)}</b> for <b>{fmt(t.want)}</b>
          </p>

          {mode === 'local' && t.from === cp && (
            <>
              {others.map((p) => {
                const eligible = hasBundle(p.resources, t.want);
                const declined = t.declined.includes(p.id);
                return (
                  <div key={p.id} className="offer__row">
                    <span className="offer__name" style={{ color: p.color }}>{p.name}</span>
                    {declined ? (
                      <span className="muted">declined</span>
                    ) : (
                      <>
                        <button className="btn btn--small" disabled={!eligible} onClick={() => acceptTrade(p.id)}>Accept</button>
                        <button className="chip-btn" onClick={() => { setCounterFor(p.id); setCGive({}); setCWant({}); }}>Counter</button>
                        <button className="chip-btn" onClick={() => declineTrade(p.id)}>✕</button>
                      </>
                    )}
                  </div>
                );
              })}
              <button className="btn btn--ghost btn--small" onClick={cancelTrade}>Cancel offer</button>
            </>
          )}

          {mode === 'local' && t.from !== cp && (
            <div className="offer__row">
              <button className="btn btn--small" disabled={!hasBundle(me.resources, t.want)} onClick={() => acceptTrade(cp)}>Accept</button>
              <button className="btn btn--ghost btn--small" onClick={cancelTrade}>Reject</button>
            </div>
          )}

          {mode === 'online' && t.from === mySeat && (
            <div className="offer__row">
              <span className="muted">Waiting for responses…</span>
              <button className="btn btn--ghost btn--small" onClick={cancelTrade}>Cancel</button>
            </div>
          )}

          {mode === 'online' && amResponder && (
            <div className="offer__row">
              <button className="btn btn--small" disabled={!hasBundle(game.players[mySeat].resources, t.want)} onClick={() => acceptTrade(mySeat)}>Accept</button>
              <button className="btn btn--ghost btn--small" onClick={() => declineTrade(mySeat)}>Decline</button>
            </div>
          )}

          {mode === 'local' && counterFor != null && t.from === cp && (
            <div className="counter">
              <p className="muted">Counter as {game.players[counterFor].name}:</p>
              <BundleEditor label="They give" bundle={cGive} setBundle={setCGive} max={game.players[counterFor].resources} />
              <BundleEditor label="They want" bundle={cWant} setBundle={setCWant} />
              <button
                className="btn btn--small"
                disabled={bundleTotal(cGive) + bundleTotal(cWant) === 0}
                onClick={() => {
                  proposeTrade({ from: counterFor, to: cp, give: clean(cGive), want: clean(cWant) });
                  setCounterFor(null);
                }}
              >
                Send counter
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BankRow({ give, rate, have, bank, onTrade }) {
  const [get, setGet] = useState(give === 'ore' ? 'lumber' : 'ore');
  const canTrade = have >= rate && give !== get && bank[get] > 0;
  return (
    <div className="bankrow">
      <span className="res__dot" style={{ background: RESOURCE_COLOR[give] }} />
      <span className="bankrow__rate">{rate}:1</span>
      <span className="muted">→</span>
      <select value={get} onChange={(e) => setGet(e.target.value)} className="mini-select">
        {RESOURCE_KEYS.filter((r) => r !== give).map((r) => (
          <option key={r} value={r}>{RESOURCE_LABEL[r]}</option>
        ))}
      </select>
      <button className="chip-btn" disabled={!canTrade} onClick={() => onTrade(give, get)}>Trade</button>
    </div>
  );
}

function BundleEditor({ label, bundle, setBundle, max }) {
  return (
    <div className="bundle">
      <span className="bundle__label">{label}</span>
      <div className="bundle__rows">
        {RESOURCE_KEYS.map((r) => {
          const n = bundle[r] ?? 0;
          const atMax = max ? n >= max[r] : false;
          return (
            <div key={r} className="bundle__cell" title={RESOURCE_LABEL[r]}>
              <span className="res__dot" style={{ background: RESOURCE_COLOR[r] }} />
              <button className="step" onClick={() => setBundle({ ...bundle, [r]: Math.max(0, n - 1) })}>−</button>
              <span className="bundle__n">{n}</span>
              <button className="step" disabled={atMax} onClick={() => setBundle({ ...bundle, [r]: n + 1 })}>+</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
