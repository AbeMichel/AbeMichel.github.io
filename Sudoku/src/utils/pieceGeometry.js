export const rotateCells = (cells, direction) => {
  // To rotate 90 deg CW: (r, c) -> (c, -r)
  // To rotate 90 deg CCW: (r, c) -> (-c, r)
  // After rotation, we normalize so top-left is (0,0)
  const rotated = cells.map(({ localRow, localCol, value }) => {
    if (direction === 'CW') {
      return { localRow: localCol, localCol: -localRow, value };
    } else {
      return { localRow: -localCol, localCol: localRow, value };
    }
  });

  const minRow = Math.min(...rotated.map(c => c.localRow));
  const minCol = Math.min(...rotated.map(c => c.localCol));

  return rotated.map(c => ({
    localRow: c.localRow - minRow,
    localCol: c.localCol - minCol,
    value: c.value
  }));
};

export const mirrorCells = (cells) => {
  // Horizontal flip: (r, c) -> (r, -c)
  const mirrored = cells.map(({ localRow, localCol, value }) => ({
    localRow,
    localCol: -localCol,
    value
  }));

  const minCol = Math.min(...mirrored.map(c => c.localCol));

  return mirrored.map(c => ({
    localRow: c.localRow,
    localCol: c.localCol - minCol,
    value: c.value
  }));
};

export const getBoundingBox = (cells) => {
  if (cells.length === 0) return { rows: 0, cols: 0 };
  const maxRow = Math.max(...cells.map(c => c.localRow));
  const maxCol = Math.max(...cells.map(c => c.localCol));
  return { rows: maxRow + 1, cols: maxCol + 1 };
};

export const getCellsAtPosition = (piece, boardRow, boardCol) => {
  const ids = [];
  for (const cell of piece.cells) {
    const r = boardRow + cell.localRow;
    const c = boardCol + cell.localCol;
    if (r >= 0 && r < 9 && c >= 0 && c < 9) {
      ids.push(r * 9 + c);
    } else {
      return null; // Out of bounds
    }
  }
  return ids;
};

export const hasOverlap = (piece, boardRow, boardCol, otherPieces) => {
  const targetIds = getCellsAtPosition(piece, boardRow, boardCol);
  if (!targetIds) return true; // Out of bounds is treated as overlap/invalid

  for (const other of otherPieces) {
    if (other.id === piece.id || other.placedAt === null) continue;
    const otherIds = getCellsAtPosition(other, other.placedAt.boardRow, other.placedAt.boardCol);
    if (!otherIds) continue;
    if (targetIds.some(id => otherIds.includes(id))) return true;
  }
  return false;
};

export const getSnapPosition = (pointerX, pointerY, boardRect, cellSize) => {
  const localX = pointerX - boardRect.left;
  const localY = pointerY - boardRect.top;
  const col = Math.floor(localX / cellSize);
  const row = Math.floor(localY / cellSize);
  return { boardRow: row, boardCol: col };
};

export function getCenterOffset(piece, cellSize) {
  const box = getBoundingBox(piece.cells);
  return {
    x: (box.cols / 2) * cellSize,
    y: (box.rows / 2) * cellSize
  };
}

export function getPieceBorderClasses(cellId, piece) {
  if (!piece || piece.placedAt === null) return [];
  const r = Math.floor(cellId / 9);
  const c = cellId % 9;
  const localRow = r - piece.placedAt.boardRow;
  const localCol = c - piece.placedAt.boardCol;

  const classes = [];
  const isPartOfPiece = (lr, lc) => piece.cells.some(cell => cell.localRow === lr && cell.localCol === lc);

  if (!isPartOfPiece(localRow - 1, localCol)) classes.push('piece-border-top');
  if (!isPartOfPiece(localRow + 1, localCol)) classes.push('piece-border-bottom');
  if (!isPartOfPiece(localRow, localCol - 1)) classes.push('piece-border-left');
  if (!isPartOfPiece(localRow, localCol + 1)) classes.push('piece-border-right');

  return classes;
}
