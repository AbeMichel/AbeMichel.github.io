import { getRow, getCol, getHighlightedIds, getConflictIds } from './boardGeometry.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Board Geometry Tests ---');

  // getRow and getCol
  assert(getRow(0) === 0 && getCol(0) === 0, 'Cell 0 is (0,0)');
  assert(getRow(80) === 8 && getCol(80) === 8, 'Cell 80 is (8,8)');
  assert(getRow(9) === 1 && getCol(9) === 0, 'Cell 9 is (1,0)');

  // getHighlightedIds
  const highlighted = getHighlightedIds(0, null);
  assert(highlighted.includes(1), 'Highlights same row');
  assert(highlighted.includes(9), 'Highlights same column');
  assert(highlighted.includes(10), 'Highlights same region');
  assert(highlighted.length === 21, 'Standard Sudoku highlighting covers 21 cells (9+9+9 - duplicates)');

  // getConflictIds
  const cells = Array.from({length: 81}, (_, i) => ({ id: i, v: 0 }));
  cells[0].v = 5;
  cells[1].v = 5; // Conflict in row
  const conflicts = getConflictIds(cells, null);
  assert(conflicts.includes(0) && conflicts.includes(1), 'Detects row conflict');

  cells[1].v = 0;
  cells[9].v = 5; // Conflict in column
  const conflicts2 = getConflictIds(cells, null);
  assert(conflicts2.includes(0) && conflicts2.includes(9), 'Detects column conflict');

  cells[9].v = 0;
  cells[10].v = 5; // Conflict in region
  const conflicts3 = getConflictIds(cells, null);
  assert(conflicts3.includes(0) && conflicts3.includes(10), 'Detects region conflict');

  cells[10].v = 0;
  assert(getConflictIds(cells, null).length === 0, 'No conflicts on clean board');
};
