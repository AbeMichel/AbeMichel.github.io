export const DIFFICULTY_ORDER = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

export const TECHNIQUES = [
  // VERY_EASY
  { id: 'NAKED_SINGLE', label: 'Naked Single', tier: 'VERY_EASY' },

  // EASY
  { id: 'HIDDEN_SINGLE', label: 'Hidden Single', tier: 'EASY' },
  { id: 'NAKED_PAIR', label: 'Naked Pair', tier: 'EASY' },
  { id: 'HIDDEN_PAIR', label: 'Hidden Pair', tier: 'EASY' },
  { id: 'NAKED_TRIPLE', label: 'Naked Triple', tier: 'EASY' },
  { id: 'HIDDEN_TRIPLE', label: 'Hidden Triple', tier: 'EASY' },
  { id: 'POINTING_PAIR', label: 'Pointing Pair', tier: 'EASY' },
  { id: 'POINTING_TRIPLE', label: 'Pointing Triple', tier: 'EASY' },
  { id: 'BOX_LINE_REDUCTION', label: 'Box Line Reduction', tier: 'EASY' },

  // MEDIUM
  { id: 'NAKED_QUAD', label: 'Naked Quad', tier: 'MEDIUM' },
  { id: 'HIDDEN_QUAD', label: 'Hidden Quad', tier: 'MEDIUM' },
  { id: 'X_WING', label: 'X-Wing', tier: 'MEDIUM' },
  { id: 'XY_WING', label: 'XY-Wing', tier: 'MEDIUM' },
  { id: 'XYZ_WING', label: 'XYZ-Wing', tier: 'MEDIUM' },
  { id: 'SKYSCRAPER', label: 'Skyscraper', tier: 'MEDIUM' },
  { id: 'TWO_STRING_KITE', label: 'Two-String Kite', tier: 'MEDIUM' },

  // HARD
  { id: 'SWORDFISH', label: 'Swordfish', tier: 'HARD' },
  { id: 'JELLYFISH', label: 'Jellyfish', tier: 'HARD' },
  { id: 'W_WING', label: 'W-Wing', tier: 'HARD' },
  { id: 'EMPTY_RECTANGLE', label: 'Empty Rectangle', tier: 'HARD' },
  { id: 'FINNED_X_WING', label: 'Finned X-Wing', tier: 'HARD' },
  { id: 'UNIQUE_RECTANGLE', label: 'Unique Rectangle', tier: 'HARD' },
  { id: 'COLORING', label: 'Simple Coloring', tier: 'HARD' },

  // VERY_HARD
  { id: 'CHAINS_AIC', label: 'Alternating Inference Chains', tier: 'VERY_HARD' },
  { id: 'BUG', label: 'Bivalue Universal Grave', tier: 'VERY_HARD' },
  { id: 'ALS', label: 'Almost Locked Sets', tier: 'VERY_HARD' }
];

export const getTier = (techniqueId) => {
  const tech = TECHNIQUES.find(t => t.id === techniqueId);
  return tech ? tech.tier : null;
};
