// ---------------------------------------------------------------------------
// Turn-phase state machine:
//   SETUP_FORWARD -> SETUP_REVERSE -> ROLL -> MAIN -> (end turn) -> ROLL ...
// After rolling, MAIN is a single phase where building, trading (bank / port /
// player) and dev cards all happen together — no separate trade/build steps.
// MOVE_ROBBER is a detour entered on a 7 or a played Knight.
// ---------------------------------------------------------------------------

export const PHASES = {
  SETUP_FORWARD: 'SETUP_FORWARD',
  SETUP_REVERSE: 'SETUP_REVERSE',
  ROLL: 'ROLL',
  MOVE_ROBBER: 'MOVE_ROBBER',
  MAIN: 'MAIN', // build + trade + dev cards, all at once
  GAME_OVER: 'GAME_OVER',
};

export const PHASE_LABEL = {
  SETUP_FORWARD: 'Setup (1 → N)',
  SETUP_REVERSE: 'Setup (N → 1)',
  ROLL: 'Roll the dice',
  MOVE_ROBBER: 'Move the robber',
  MAIN: 'Build & Trade',
  GAME_OVER: 'Game over',
};

export const isSetupPhase = (phase) =>
  phase === PHASES.SETUP_FORWARD || phase === PHASES.SETUP_REVERSE;
