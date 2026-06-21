// ---------------------------------------------------------------------------
// Turn-phase state machine. The core loop the outline asks for:
//   SETUP_FORWARD -> SETUP_REVERSE -> ROLL -> TRADE -> BUILD -> END_TURN
// MOVE_ROBBER is a detour entered when a 7 is rolled. TRADE and BUILD are
// navigable now but stay light until Phases 5 and 4 flesh them out.
// ---------------------------------------------------------------------------

export const PHASES = {
  SETUP_FORWARD: 'SETUP_FORWARD',
  SETUP_REVERSE: 'SETUP_REVERSE',
  ROLL: 'ROLL',
  MOVE_ROBBER: 'MOVE_ROBBER',
  TRADE: 'TRADE',
  BUILD: 'BUILD',
  GAME_OVER: 'GAME_OVER',
};

export const PHASE_LABEL = {
  SETUP_FORWARD: 'Setup (1 → N)',
  SETUP_REVERSE: 'Setup (N → 1)',
  ROLL: 'Roll the dice',
  MOVE_ROBBER: 'Move the robber',
  TRADE: 'Trade',
  BUILD: 'Build',
  GAME_OVER: 'Game over',
};

export const isSetupPhase = (phase) =>
  phase === PHASES.SETUP_FORWARD || phase === PHASES.SETUP_REVERSE;
