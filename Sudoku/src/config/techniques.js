export const DIFFICULTY_ORDER = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

export const TECHNIQUES = [
  // VERY_EASY
  { id: 'NAKED_SINGLE', label: 'Naked Single', tier: 'VERY_EASY', baseMultiplier: 1 },

  // EASY
  { id: 'HIDDEN_SINGLE', label: 'Hidden Single', tier: 'EASY', baseMultiplier: 2 },
  { id: 'NAKED_PAIR', label: 'Naked Pair', tier: 'EASY', baseMultiplier: 5 },
  { id: 'HIDDEN_PAIR', label: 'Hidden Pair', tier: 'EASY', baseMultiplier: 10 },
  { id: 'NAKED_TRIPLE', label: 'Naked Triple', tier: 'EASY', baseMultiplier: 10 },
  { id: 'HIDDEN_TRIPLE', label: 'Hidden Triple', tier: 'EASY', baseMultiplier: 25 },
  { id: 'POINTING_PAIR', label: 'Pointing Pair', tier: 'EASY', baseMultiplier: 20 },
  { id: 'POINTING_TRIPLE', label: 'Pointing Triple', tier: 'EASY', baseMultiplier: 20 },
  { id: 'BOX_LINE_REDUCTION', label: 'Box Line Reduction', tier: 'EASY', baseMultiplier: 20 },

  // MEDIUM
  { id: 'NAKED_QUAD', label: 'Naked Quad', tier: 'MEDIUM', baseMultiplier: 40 },
  { id: 'HIDDEN_QUAD', label: 'Hidden Quad', tier: 'MEDIUM', baseMultiplier: 60 },
  { id: 'X_WING', label: 'X-Wing', tier: 'MEDIUM', baseMultiplier: 30 },
  { id: 'XY_WING', label: 'XY-Wing', tier: 'MEDIUM', baseMultiplier: 50 },
  { id: 'XYZ_WING', label: 'XYZ-Wing', tier: 'MEDIUM', baseMultiplier: 60 },
  { id: 'SKYSCRAPER', label: 'Skyscraper', tier: 'MEDIUM', baseMultiplier: 50 },
  { id: 'TWO_STRING_KITE', label: 'Two-String Kite', tier: 'MEDIUM', baseMultiplier: 50 },

  // HARD
  { id: 'SWORDFISH', label: 'Swordfish', tier: 'HARD', baseMultiplier: 50 },
  { id: 'JELLYFISH', label: 'Jellyfish', tier: 'HARD', baseMultiplier: 80 },
  { id: 'W_WING', label: 'W-Wing', tier: 'HARD', baseMultiplier: 50 },
  { id: 'EMPTY_RECTANGLE', label: 'Empty Rectangle', tier: 'HARD', baseMultiplier: 50 },
  { id: 'FINNED_X_WING', label: 'Finned X-Wing', tier: 'HARD', baseMultiplier: 160 },
  { id: 'UNIQUE_RECTANGLE', label: 'Unique Rectangle', tier: 'HARD', baseMultiplier: 20 },
  { id: 'COLORING', label: 'Simple Coloring', tier: 'HARD', baseMultiplier: 50 },

  // VERY_HARD
  { id: 'CHAINS_AIC', label: 'Alternating Inference Chains', tier: 'VERY_HARD', baseMultiplier: 100 },
  { id: 'BUG', label: 'Bivalue Universal Grave', tier: 'VERY_HARD', baseMultiplier: 30 },
  { id: 'ALS', label: 'Almost Locked Sets', tier: 'VERY_HARD', baseMultiplier: 140 }
];

export const getTier = (techniqueId) => {
  const tech = TECHNIQUES.find(t => t.id === techniqueId);
  return tech ? tech.tier : null;
};

export const TECHNIQUE_MULTIPLIERS = Object.fromEntries(
  TECHNIQUES.map(t => [t.id, t.baseMultiplier])
);
