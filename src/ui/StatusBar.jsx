// Turn controller: shows the current phase/player, the dice, and the single
// contextual action the active player can take right now.

import { useGameStore } from '../engine/store.js';
import { PHASES, PHASE_LABEL, isSetupPhase } from '../engine/phases.js';

export default function StatusBar() {
  const game = useGameStore((s) => s.game);
  const canUndo = useGameStore((s) => s.history.length > 0);
  const rollDice = useGameStore((s) => s.rollDice);
  const nextPhase = useGameStore((s) => s.nextPhase);
  const endTurn = useGameStore((s) => s.endTurn);
  const undo = useGameStore((s) => s.undo);
  const stealFrom = useGameStore((s) => s.stealFrom);

  const current = game.players[game.currentPlayer];
  const gameOver = game.phase === PHASES.GAME_OVER;

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
          <span className="die">{game.dice[0]}</span>
          <span className="die">{game.dice[1]}</span>
          <span className="dice__total">= {game.diceTotal}</span>
        </div>
      )}

      <div className="status__action">
        {isSetupPhase(game.phase) && (
          <p className="hint">
            {game.awaitingRoad ? 'Click a highlighted edge to place a road.' : 'Click a highlighted spot to place a settlement.'}
            {game.phase === PHASES.SETUP_REVERSE && !game.awaitingRoad && ' Your 2nd settlement collects resources.'}
          </p>
        )}

        {game.phase === PHASES.ROLL && (
          <button className="btn" onClick={rollDice}>🎲 Roll dice</button>
        )}

        {game.phase === PHASES.MOVE_ROBBER && !game.pendingSteal && (
          <p className="hint">Click any hex to move the robber there.</p>
        )}

        {game.pendingSteal && (
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

        {game.phase === PHASES.TRADE && (
          <>
            <p className="hint">Trading arrives in Phase 5.</p>
            <button className="btn" onClick={nextPhase}>Go to Build →</button>
          </>
        )}

        {game.phase === PHASES.BUILD && (
          <>
            <p className="hint">Building arrives in Phase 4.</p>
            <button className="btn" onClick={endTurn}>End turn ↻</button>
          </>
        )}
      </div>

      <button className="btn btn--ghost" onClick={undo} disabled={!canUndo}>
        ↶ Undo
      </button>
    </div>
  );
}
