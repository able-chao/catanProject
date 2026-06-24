// ---------------------------------------------------------------------------
// Action enrichment: fills in the randomness an action needs (dice values, the
// stolen card) BEFORE it reaches the pure reducer.
//
// Clients send "bare" intents (e.g. { type: ROLL_DICE }). In local play the
// store enriches them; in online play the SERVER enriches them. Either way the
// reducer stays pure and replayable, and — per the Phase 7 key insight — the
// client never decides what the dice are.
// ---------------------------------------------------------------------------

import { ACTIONS } from './actions.js';
import { RESOURCE_KEYS } from './setup.js';

const d6 = () => 1 + Math.floor(Math.random() * 6);

export function enrichAction(action, game) {
  if (action.type === ACTIONS.ROLL_DICE && !action.dice) {
    return { ...action, dice: [d6(), d6()] };
  }
  if (action.type === ACTIONS.STEAL && action.fromPlayer != null && action.resource === undefined) {
    const target = game.players[action.fromPlayer];
    const pool = [];
    for (const r of RESOURCE_KEYS) {
      for (let i = 0; i < target.resources[r]; i++) pool.push(r);
    }
    return { ...action, resource: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null };
  }
  return action;
}
