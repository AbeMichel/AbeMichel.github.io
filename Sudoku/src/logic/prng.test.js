import { createPRNG } from './prng.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running PRNG Tests ---');

  // Same seed produces same sequence
  const prng1 = createPRNG('test-seed');
  const prng2 = createPRNG('test-seed');
  const seq1 = [prng1.next(), prng1.nextInt(1, 10), prng1.nextInt(1, 100)];
  const seq2 = [prng2.next(), prng2.nextInt(1, 10), prng2.nextInt(1, 100)];
  assert(seq1.every((v, i) => v === seq2[i]), 'Same seed produces same sequence');

  // Different seeds produce different sequences
  const prng3 = createPRNG('another-seed');
  const seq3 = [prng3.next(), prng3.nextInt(1, 10), prng3.nextInt(1, 100)];
  assert(!seq1.every((v, i) => v === seq3[i]), 'Different seeds produce different sequences');

  // nextInt stays within bounds
  const prngBounds = createPRNG(12345);
  let withinBounds = true;
  for (let i = 0; i < 1000; i++) {
    const val = prngBounds.nextInt(5, 15);
    if (val < 5 || val > 15) {
      withinBounds = false;
      break;
    }
  }
  assert(withinBounds, 'nextInt stays within bounds across 1000 samples');

  // shuffle returns all original elements in a different order (usually)
  const prngShuffle = createPRNG(999);
  const original = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const shuffled = prngShuffle.shuffle(original);
  
  assert(shuffled.length === original.length, 'Shuffled array has same length');
  assert([...shuffled].sort().join(',') === [...original].sort().join(','), 'Shuffled array contains exact same elements');
  assert(shuffled.join(',') !== original.join(','), 'Shuffled array is in a different order');
};
