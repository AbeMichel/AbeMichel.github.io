import { solve, hasUniqueSolution } from './solver.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Solver Tests ---');

  // Helper to parse strings
  const parseGrid = (str) => str.replace(/[^0-9]/g, '').split('').map(Number);

  // A known simple puzzle
  const easyStr = `
    5 3 0 0 7 0 0 0 0
    6 0 0 1 9 5 0 0 0
    0 9 8 0 0 0 0 6 0
    8 0 0 0 6 0 0 0 3
    4 0 0 8 0 3 0 0 1
    7 0 0 0 2 0 0 0 6
    0 6 0 0 0 0 2 8 0
    0 0 0 4 1 9 0 0 5
    0 0 0 0 8 0 0 7 9
  `;
  const easyGrid = parseGrid(easyStr);
  const solution = solve(easyGrid);
  assert(solution !== null, 'Solver returns a solution for a valid puzzle');
  assert(solution[0] === 5 && solution[2] === 4, 'Solution is correct (checked a few cells)');
  assert(hasUniqueSolution(easyGrid) === true, 'hasUniqueSolution returns true for valid puzzle');

  // A puzzle with two solutions (empty grid)
  const emptyGrid = new Array(81).fill(0);
  assert(hasUniqueSolution(emptyGrid) === false, 'Empty grid does not have a unique solution');

  // A puzzle that is already solved
  const solvedGrid = [...solution];
  const solvedResult = solve(solvedGrid);
  assert(solvedResult !== null && solvedResult.join(',') === solvedGrid.join(','), 'Already-solved grid returns itself');
};
