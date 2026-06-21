// ---------------------------------------------------------------------------
// Global state (Zustand). In Phase 1 the "engine" only holds the generated
// board geometry and a few view toggles — real game state arrives in Phase 3.
// ---------------------------------------------------------------------------

import { create } from 'zustand';
import { generateBoard } from '../board/board.js';

const DEFAULT_SIZE = 56;

export const useGameStore = create((set) => ({
  size: DEFAULT_SIZE,
  board: generateBoard({ size: DEFAULT_SIZE, radius: 2 }),

  // Visual overlays — Phase 1 is about *seeing* the geometry we computed.
  show: {
    coords: true, // q,r,s label in each hex
    vertices: false, // settlement spots
    edges: false, // road spots
  },

  toggle: (key) => set((s) => ({ show: { ...s.show, [key]: !s.show[key] } })),

  setSize: (size) => set(() => ({ size, board: generateBoard({ size, radius: 2 }) })),
}));
