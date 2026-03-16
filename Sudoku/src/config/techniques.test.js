import { TECHNIQUES, DIFFICULTY_ORDER, getTier } from './techniques.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Techniques Tests ---');

  // Verify all 25 techniques
  assert(TECHNIQUES.length === 26, 'TECHNIQUES array contains exactly 26 techniques');
  // No duplicate ids
  const ids = TECHNIQUES.map(t => t.id);
  const uniqueIds = new Set(ids);
  assert(ids.length === uniqueIds.size, 'No duplicate technique ids');

  // Every tier is a valid value from DIFFICULTY_ORDER
  let allTiersValid = true;
  for (const tech of TECHNIQUES) {
    if (!DIFFICULTY_ORDER.includes(tech.tier)) {
      allTiersValid = false;
      break;
    }
  }
  assert(allTiersValid, 'All technique tiers are valid values from DIFFICULTY_ORDER');

  // getTier returns correct tier for known technique ids
  assert(getTier('NAKED_SINGLE') === 'VERY_EASY', 'getTier works for VERY_EASY');
  assert(getTier('BUG') === 'VERY_HARD', 'getTier works for VERY_HARD');
  assert(getTier('INVALID_ID') === null, 'getTier returns null for invalid id');

  // Array is ordered VERY_EASY → VERY_HARD
  let isOrdered = true;
  let currentTierIndex = 0;
  for (const tech of TECHNIQUES) {
    const tierIndex = DIFFICULTY_ORDER.indexOf(tech.tier);
    if (tierIndex < currentTierIndex) {
      isOrdered = false;
      break;
    }
    currentTierIndex = tierIndex;
  }
  assert(isOrdered, 'TECHNIQUES array is ordered from simplest to most complex');
};
