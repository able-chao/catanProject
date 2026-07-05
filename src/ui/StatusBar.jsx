// Turn controller: shows the current phase/player, the dice, and the single
// contextual action the active player can take right now.

import { motion } from 'framer-motion';
import { useGameStore } from '../engine/store.js';
import { PHASES, PHASE_LABEL, isSetupPhase } from '../engine/phases.js';
import { BUILD_COSTS, expandCost } from '../engine/building.js';
import { RESOURCE_COLOR, RESOURCE_LABEL } from '../engine/setup.js';

export default function StatusBar() {
  const game = useGameStore((s) => s.game);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const rollDice = useGameStore((s) => s.rollDice);
  const endTurn = useGameStore((s) => s.endTurn);
  const undo = useGameStore((s) => s.undo);
  const stealFrom = useGameStore((s) => s.stealFrom);
  const mode = useGameStore((s) => s.mode);
  const mySeat = useGameStore((s) => s.mySeat);

  const current = game.players[game.currentPlayer];
  const gameOver = game.phase === PHASES.GAME_OVER;
  // Online: you only act on your own turn.
  const canAct = mode === 'local' || game.currentPlayer === mySeat;
  // Can't leave the phase while a trade, dev-card effect or gold pick is unresolved.
  const blocked =
    Boolean(game.pendingTrade) ||
    game.pendingYearOfPlenty ||
    game.pendingMonopoly ||
    game.pendingRoadBuilding > 0 ||
    Boolean(game.pendingGold?.length);

  return (
    <div className="status">
      <div className="status__top">
        <span className="status__phase">{PHASE_LABEL[game.phase]}</span>
        {!isSetupPhase(game.phase) && !gameOver && <span className="status__turn">Turn {game.turn}</span>}
      </div>

      {gameOver ? (
        <div className="status__winner" style={{ borderColor: current.color }}>
          🏆 {game.players[game.winner].name} wins!
        </div>
      ) : (
        <div className="status__player">
          <span className="status__chip" style={{ background: current.color }} />
          <span>{current.name}</span>
        </div>
      )}

      {game.dice && (
        <div className="dice">
          {game.dice.map((d, i) => (
            <motion.span
              key={`${game.rollCount}-${i}`}
              className="die"
              initial={{ rotate: -150, scale: 0.3, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 360, damping: 15, delay: i * 0.09 }}
            >
              {d}
            </motion.span>
          ))}
          <span className="dice__total">= {game.diceTotal}</span>
        </div>
      )}

      <div className="status__action">
        {mode === 'online' && !canAct && !gameOver && (
          <p className="hint">Waiting for {current.name}…</p>
        )}

        {canAct && isSetupPhase(game.phase) && (
          <p className="hint">
            {game.awaitingRoad ? 'Click a highlighted edge to place a road.' : 'Click a highlighted spot to place a settlement.'}
            {game.phase === PHASES.SETUP_REVERSE && !game.awaitingRoad && ' Your 2nd settlement collects resources.'}
          </p>
        )}

        {canAct && game.phase === PHASES.ROLL && (
          <button className="btn" onClick={rollDice}>🎲 Roll dice</button>
        )}

        {canAct && game.phase === PHASES.MOVE_ROBBER && !game.pendingSteal && (
          <p className="hint">
            Drag the robber, or click a highlighted hex to move it.
            {game.options?.friendlyRobber && ' Friendly robber: players under 3 VP are protected.'}
          </p>
        )}

        {canAct && game.pendingSteal && (
          <div className="steal">
            <p className="hint">Steal from:</p>
            <div className="steal__targets">
              {game.pendingSteal.candidates.map((pid) => (
                <button
                  key={pid}
                  className="btn btn--small"
                  style={{ background: game.players[pid].color }}
                  onClick={() => stealFrom(pid)}
                >
                  {game.players[pid].name}
                </button>
              ))}
            </div>
          </div>
        )}

        {canAct && game.phase === PHASES.MAIN && (
          <>
            <p className="hint">Build, trade, or play dev cards — all in any order — then end your turn.</p>
            <div className="builds">
              <BuildOption label="Road" cost={BUILD_COSTS.road} enabled={game.valid?.roads.length > 0} />
              <BuildOption label="Settlement" cost={BUILD_COSTS.settlement} enabled={game.valid?.settlements.length > 0} />
              <BuildOption label="City" cost={BUILD_COSTS.city} enabled={game.valid?.cities.length > 0} />
            </div>
            <button className="btn" onClick={endTurn} disabled={blocked}>End turn ↻</button>
          </>
        )}
      </div>

      {mode === 'local' && (
        <button className="btn btn--ghost" onClick={undo} disabled={!canUndo}>
          ↶ Undo
        </button>
      )}
    </div>
  );
}

function BuildOption({ label, cost, enabled }) {
  return (
    <div className={`build${enabled ? '' : ' build--off'}`}>
      <span className="build__name">{label}</span>
      <span className="build__cost">
        {expandCost(cost).map((r, i) => (
          <span key={i} className="res__dot" style={{ background: RESOURCE_COLOR[r] }} title={RESOURCE_LABEL[r]} />
        ))}
      </span>
    </div>
  );
}
