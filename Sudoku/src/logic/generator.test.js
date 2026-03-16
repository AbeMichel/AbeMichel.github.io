import { generatePuzzle, generateChaosRegions, getDailyConfig } from './generator.js';
import { solve, hasUniqueSolution } from './solver.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Generator Tests ---');

  // getDailyConfig
  const daily1 = getDailyConfig('2026-03-15');
  const daily2 = getDailyConfig('2026-03-15');
  assert(daily1.seed === daily2.seed && daily1.difficulty === daily2.difficulty, 'getDailyConfig returns identical output for same date');

  // Chaos regions
  const regions = generateChaosRegions('chaos-seed');
  assert(regions.length === 9, 'Chaos generates 9 regions');
  
  const flatRegions = regions.flat();
  const uniqueCells = new Set(flatRegions);
  assert(flatRegions.length === 81 && uniqueCells.size === 81, 'Chaos regions cover all 81 cells with no overlaps');

  // generatePuzzle structure and solution uniqueness
  const puzzle = generatePuzzle({ difficulty: 'HARD', seed: 'test-seed', mode: 'STANDARD' });
  assert(puzzle.cells && puzzle.cells.length === 81, 'generatePuzzle returns 81 cells');
  assert(puzzle.cells[0].hasOwnProperty('id') && puzzle.cells[0].hasOwnProperty('v'), 'Cell object has correct structure');
  
  const grid = puzzle.cells.map(c => c.v ? c.v : 0);
  assert(hasUniqueSolution(grid), 'Generated puzzle has a unique solution');

  // Same seed + difficulty produces identical output
  const puzzle2 = generatePuzzle({ difficulty: 'HARD', seed: 'test-seed', mode: 'STANDARD' });
  assert(JSON.stringify(puzzle.cells) === JSON.stringify(puzzle2.cells), 'Same seed + difficulty produces identical output');

  // Explicit clues parameter
  const cluesPuzzle = generatePuzzle({ seed: 'test-seed-2', mode: 'STANDARD', clues: 35 });
  const actualClues = cluesPuzzle.cells.filter(c => c.fixed).length;
  // It might not exactly hit 35 if symmetry or uniqueness forces a slight change, but it should be close.
  // Actually, our generator digs down to `targetClues` strictly if uniqueness holds, so it should be exactly targetClues or slightly more if it got stuck.
  assert(actualClues >= 35 && actualClues <= 38, `Explicit clues parameter respected (requested 35, got ${actualClues})`);
};
