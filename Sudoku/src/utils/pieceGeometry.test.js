import { rotateCells, mirrorCells, getBoundingBox, getCellsAtPosition, hasOverlap } from './pieceGeometry.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Piece Geometry Tests ---');

  // L-shaped piece: (0,0), (1,0), (1,1)
  const pieceCells = [
    { localRow: 0, localCol: 0, value: 1 },
    { localRow: 1, localCol: 0, value: 2 },
    { localRow: 1, localCol: 1, value: 3 }
  ];

  // rotateCells CW: (0,0) -> (0,0), (1,0) -> (0,1), (1,1) -> (1,1) ? No
  // (0,0) -> (0,-0) -> (0,0)
  // (1,0) -> (0,-1) -> (0,-1)
  // (1,1) -> (1,-1) -> (1,-1)
  // normalize: minR=0, minC=-1 -> (0,1), (0,0), (1,0)
  const rotated = rotateCells(pieceCells, 'CW');
  assert(rotated.length === 3, 'rotateCells CW returns 3 cells');
  assert(rotated.some(c => c.localRow === 0 && c.localCol === 1 && c.value === 1), 'rotateCells CW correctly transforms (0,0)');
  assert(rotated.some(c => c.localRow === 0 && c.localCol === 0 && c.value === 2), 'rotateCells CW correctly transforms (1,0)');
  assert(rotated.some(c => c.localRow === 1 && c.localCol === 0 && c.value === 3), 'rotateCells CW correctly transforms (1,1)');

  // inverse
  const rotatedBack = rotateCells(rotated, 'CCW');
  assert(JSON.stringify(rotatedBack.sort((a,b) => a.value - b.value)) === JSON.stringify(pieceCells.sort((a,b) => a.value - b.value)), 'rotateCells CCW is inverse of CW');

  // mirrorCells
  const mirrored = mirrorCells(pieceCells);
  assert(mirrored.some(c => c.localRow === 0 && c.localCol === 1 && c.value === 1), 'mirrorCells flips (0,0)');
  assert(mirrored.some(c => c.localRow === 1 && c.localCol === 1 && c.value === 2), 'mirrorCells flips (1,0)');
  assert(mirrored.some(c => c.localRow === 1 && c.localCol === 0 && c.value === 3), 'mirrorCells flips (1,1)');

  // getBoundingBox
  const bbox = getBoundingBox(pieceCells);
  assert(bbox.rows === 2 && bbox.cols === 2, 'getBoundingBox returns correct dimensions');

  // getCellsAtPosition
  const boardIds = getCellsAtPosition({ cells: pieceCells }, 0, 0);
  assert(JSON.stringify(boardIds) === JSON.stringify([0, 9, 10]), 'getCellsAtPosition returns correct absolute ids');
  assert(getCellsAtPosition({ cells: pieceCells }, 8, 8) === null, 'getCellsAtPosition returns null for out of bounds');

  // hasOverlap
  const piece1 = { id: 1, cells: pieceCells, placedAt: { boardRow: 0, boardCol: 0 } };
  const piece2 = { id: 2, cells: [{ localRow: 0, localCol: 0, value: 5 }], placedAt: null };
  
  assert(hasOverlap(piece2, 0, 0, [piece1]), 'hasOverlap detects overlap');
  assert(!hasOverlap(piece2, 0, 2, [piece1]), 'hasOverlap returns false for no overlap');
};
