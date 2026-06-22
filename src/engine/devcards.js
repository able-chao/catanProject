// ---------------------------------------------------------------------------
// Development cards: deck composition, cost, and helpers.
//
// Deck (25 cards): 14 Knight, 5 Victory Point, 2 Road Building, 2 Year of
// Plenty, 2 Monopoly. Bought for 1 ore + 1 wool + 1 grain.
//
// Play rules (enforced in the reducer): a card can't be played the turn it was
// bought, can't be played before rolling, and only one card may be played per
// turn. VP cards aren't "played" — they count toward your total immediately.
// ---------------------------------------------------------------------------

import { shuffle } from '../utils/random.js';

export const DEV = {
  KNIGHT: 'knight',
  VP: 'vp',
  ROAD_BUILDING: 'roadBuilding',
  YEAR_OF_PLENTY: 'yearOfPlenty',
  MONOPOLY: 'monopoly',
};

export const DEV_DECK = {
  knight: 14,
  vp: 5,
  roadBuilding: 2,
  yearOfPlenty: 2,
  monopoly: 2,
};

export const DEV_COST = { ore: 1, wool: 1, grain: 1 };

export const DEV_LABEL = {
  knight: 'Knight',
  vp: 'Victory Point',
  roadBuilding: 'Road Building',
  yearOfPlenty: 'Year of Plenty',
  monopoly: 'Monopoly',
};

// Cards the player can actively play (VP is passive).
export const PLAYABLE_DEV = [DEV.KNIGHT, DEV.ROAD_BUILDING, DEV.YEAR_OF_PLENTY, DEV.MONOPOLY];

export function emptyDevHand() {
  return { knight: 0, vp: 0, roadBuilding: 0, yearOfPlenty: 0, monopoly: 0 };
}

/** A shuffled 25-card deck (array of card-type strings). */
export function buildDevDeck(rng) {
  const deck = [];
  for (const [type, n] of Object.entries(DEV_DECK)) {
    for (let i = 0; i < n; i++) deck.push(type);
  }
  return shuffle(deck, rng);
}
