export const DIFFICULTY_DEFAULTS = {
  VERY_EASY: 45,
  EASY: 38,
  MEDIUM: 32,
  HARD: 27,
  VERY_HARD: 23
};

export const SCORE_RANGES = {
  VERY_EASY: [0,   3.0],
  EASY:      [3.0, 4.0],
  MEDIUM:    [4.0, 5.0],
  HARD:      [5.0, 7.0],
  VERY_HARD: [7.0, 9.0],
};

export function normalizeScore(rawScore) {
  if (rawScore <= 0) return 0;
  return (Math.log(rawScore) / Math.log(5)) * 2;
}

export function getDifficultyFromScore(normalizedScore) {
  for (const [key, [min, max]] of Object.entries(SCORE_RANGES)) {
    if (normalizedScore >= min && normalizedScore < max) {
      return key;
    }
  }
  return normalizedScore < 3.0 ? 'VERY_EASY' : 'VERY_HARD';
}

export function isScoreInRange(normalizedScore, difficulty) {
  const range = SCORE_RANGES[difficulty];
  if (!range) return false;
  return normalizedScore >= range[0] && normalizedScore < range[1];
}
