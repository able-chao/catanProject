// Win screen: shown on GAME_OVER with a full VP breakdown for every player.

import { motion } from 'framer-motion';
import { useGameStore } from '../engine/store.js';
import { PHASES } from '../engine/phases.js';
import { totalVictoryPoints, vpBreakdown } from '../engine/setup.js';

const COLS = ['Settle', 'City', 'VP', 'Road', 'Army'];

export default function EndScreen() {
  const game = useGameStore((s) => s.game);
  const newGame = useGameStore((s) => s.newGame);

  if (game.phase !== PHASES.GAME_OVER || game.winner == null) return null;

  const winner = game.players[game.winner];
  const ranked = [...game.players].sort(
    (a, b) => totalVictoryPoints(game, b.id) - totalVictoryPoints(game, a.id),
  );

  return (
    <div className="endscreen">
      <motion.div
        className="endscreen__card"
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="endscreen__crown">🏆</div>
        <h2 className="endscreen__title" style={{ color: winner.color }}>{winner.name} wins!</h2>
        <p className="muted">{totalVictoryPoints(game, game.winner)} victory points</p>

        <table className="vp-table">
          <thead>
            <tr>
              <th>Player</th>
              {COLS.map((c) => <th key={c}>{c}</th>)}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((p) => (
              <tr key={p.id} className={p.id === game.winner ? 'vp-table__win' : ''}>
                <td>
                  <span className="dot" style={{ background: p.color }} /> {p.name}
                </td>
                {vpBreakdown(game, p.id).map((b) => (
                  <td key={b.label}>{b.value || '·'}</td>
                ))}
                <td className="vp-total">{totalVictoryPoints(game, p.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="btn" onClick={() => newGame()}>New game</button>
      </motion.div>
    </div>
  );
}
