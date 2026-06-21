// ---------------------------------------------------------------------------
// Global state (Zustand). Holds the generated board plus a few view toggles.
// `regenerate()` rolls a new random board; `seed` makes any board reproducible.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { generateBoard } from '../board/board.js';
import { randomSeed } from '../utils/random.js';

const INITIAL_SEED = randomSeed();

export const useGameStore = create((set) => ({
  board: generateBoard({ seed: INITIAL_SEED }),

  // Dev overlays — off by default now that the board is fully painted.
  show: {
    coords: false, // q,r,s label in each hex
    vertices: false, // settlement spots
    edges: false, // road spots
  },

  toggle: (key) => set((s) => ({ show: { ...s.show, [key]: !s.show[key] } })),

  regenerate: () => set(() => ({ board: generateBoard({ seed: randomSeed() }) })),
}));
