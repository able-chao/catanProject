// Typed action dispatch. Every change to game state flows through one of these
// action types into the reducer. Actions that involve randomness (dice, the
// stolen card) carry the resolved value in their payload, so the action log
// alone can deterministically replay a whole game.

export const ACTIONS = {
  PLACE_SETTLEMENT: 'PLACE_SETTLEMENT', // { vertexId }
  PLACE_ROAD: 'PLACE_ROAD', //            { edgeId }
  ROLL_DICE: 'ROLL_DICE', //              { dice: [d1, d2] }
  MOVE_ROBBER: 'MOVE_ROBBER', //          { hexId }
  STEAL: 'STEAL', //                      { fromPlayer, resource }
  NEXT_PHASE: 'NEXT_PHASE', //            (TRADE -> BUILD)
  END_TURN: 'END_TURN', //                advance to next player's ROLL
};
