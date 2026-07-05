// Typed action dispatch. Every change to game state flows through one of these
// action types into the reducer. Actions that involve randomness (dice, the
// stolen card) carry the resolved value in their payload, so the action log
// alone can deterministically replay a whole game.

export const ACTIONS = {
  PLACE_SETTLEMENT: 'PLACE_SETTLEMENT', // { vertexId }   (free, setup only)
  PLACE_ROAD: 'PLACE_ROAD', //            { edgeId }      (free, setup only)
  BUILD_ROAD: 'BUILD_ROAD', //            { edgeId }      (costs resources)
  BUILD_SETTLEMENT: 'BUILD_SETTLEMENT', //{ vertexId }
  BUILD_CITY: 'BUILD_CITY', //            { vertexId }    (upgrade a settlement)
  ROLL_DICE: 'ROLL_DICE', //              { dice: [d1, d2] }
  MOVE_ROBBER: 'MOVE_ROBBER', //          { hexId }
  STEAL: 'STEAL', //                      { fromPlayer, resource }
  END_TURN: 'END_TURN', //                advance to next player's ROLL

  // --- Phase 5: trading & dev cards ---
  BANK_TRADE: 'BANK_TRADE', //            { give, get }  (give N:1 for 1)
  PROPOSE_TRADE: 'PROPOSE_TRADE', //      { from, to, give, want }
  ACCEPT_TRADE: 'ACCEPT_TRADE', //        { playerId }   (the other party accepts)
  DECLINE_TRADE: 'DECLINE_TRADE', //      { playerId }
  CANCEL_TRADE: 'CANCEL_TRADE',
  BUY_DEV: 'BUY_DEV',
  PLAY_KNIGHT: 'PLAY_KNIGHT',
  PLAY_ROAD_BUILDING: 'PLAY_ROAD_BUILDING',
  PLAY_YEAR_OF_PLENTY: 'PLAY_YEAR_OF_PLENTY',
  PLAY_MONOPOLY: 'PLAY_MONOPOLY',
  PLACE_FREE_ROAD: 'PLACE_FREE_ROAD', //  { edgeId }     (Road Building)
  SKIP_ROAD_BUILDING: 'SKIP_ROAD_BUILDING',
  PICK_YEAR_OF_PLENTY: 'PICK_YEAR_OF_PLENTY', // { resources: [r, r] }
  PICK_MONOPOLY: 'PICK_MONOPOLY', //      { resource }
  PICK_GOLD: 'PICK_GOLD', //              { resources: [r, ...] } (gold-field payout)
};
