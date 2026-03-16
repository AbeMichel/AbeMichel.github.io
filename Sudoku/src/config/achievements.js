export const ACHIEVEMENTS = [
  { id: 'FIRST_SOLVE', label: 'First Solve', description: 'Complete any puzzle', condition: (state) => state.game.status === 'WON' },
  { id: 'SPEED_DEMON', label: 'Speed Demon', description: 'Solve a puzzle in under 3 minutes', condition: (state) => state.game.status === 'WON' && state.game.timer < 180000 },
  { id: 'NO_MISTAKES', label: 'No Mistakes', description: 'Solve a puzzle with 0 mistakes', condition: (state) => state.game.status === 'WON' && state.game.mistakes === 0 },
  { id: 'HINT_FREE', label: 'Hint Free', description: 'Solve a puzzle without using any hints', condition: (state) => state.game.status === 'WON' && (state.game._hintsUsedInThisGame === 0 || state.game._hintsUsedInThisGame === undefined) },
  { id: 'CHAOS_COMPLETE', label: 'Chaos Complete', description: 'Complete a Chaos mode puzzle', condition: (state) => state.game.status === 'WON' && state.game.mode === 'CHAOS' },
  { id: 'RECON_COMPLETE', label: 'Recon Complete', description: 'Complete a Reconstruction mode puzzle', condition: (state) => state.game.status === 'WON' && state.game.mode === 'RECONSTRUCTION' },
  { id: 'FRAGILE_COMPLETE', label: 'Fragile Complete', description: 'Complete a puzzle with Fragile modifier active', condition: (state) => state.game.status === 'WON' && state.modifiers.active.includes('FRAGILE') },
  { id: 'ORDERED_COMPLETE', label: 'Ordered Complete', description: 'Complete a puzzle with Ordered modifier active', condition: (state) => state.game.status === 'WON' && state.modifiers.active.includes('ORDERED') },
  { id: 'FIVE_STREAK', label: 'Five Streak', description: 'Achieve a daily streak of 5', condition: (state) => state.stats.streaks >= 5 },
  { id: 'TEN_STREAK', label: 'Ten Streak', description: 'Achieve a daily streak of 10', condition: (state) => state.stats.streaks >= 10 },
  { id: 'USE_FIVE_HINTS', label: 'Hint User', description: 'Use 5 or more hints in total', condition: (state) => state.stats.hintsUsed >= 5 },
  { id: 'VERY_HARD_SOLVE', label: 'Master Solver', description: 'Solve a VERY_HARD difficulty puzzle', condition: (state) => state.game.status === 'WON' && state.game.difficulty === 'VERY_HARD' },
  { id: 'CANDIDATE_MASTER', label: 'Candidate Master', description: 'Solve a puzzle using only candidate marks', condition: (state) => state.game.status === 'WON' && (state.game._valueErrors === 0 || state.game._valueErrors === undefined) },
  { id: 'SPEED_VERY_HARD', label: 'Expert Speed Demon', description: 'Solve a VERY_HARD puzzle in under 10 minutes', condition: (state) => state.game.status === 'WON' && state.game.difficulty === 'VERY_HARD' && state.game.timer < 600000 },
  { id: 'ALL_MODIFIERS', label: 'Chaos King', description: 'Complete a puzzle with 3 or more modifiers active', condition: (state) => state.game.status === 'WON' && state.modifiers.active.length >= 3 }
];
