class DLXNode {
  constructor(column) {
    this.L = this;
    this.R = this;
    this.U = this;
    this.D = this;
    this.C = column;
    this.rowId = -1;
  }
}

class DLXColumn extends DLXNode {
  constructor(id) {
    super(null);
    this.C = this;
    this.id = id;
    this.size = 0;
  }
}

const buildDLX = (grid, regions) => {
  const header = new DLXColumn(-1);
  const columns = [];
  
  for (let i = 0; i < 324; i++) {
    const col = new DLXColumn(i);
    columns.push(col);
    col.L = header.L;
    col.R = header;
    header.L.R = col;
    header.L = col;
  }

  const addRow = (rowId, cols) => {
    let firstNode = null;
    for (const colIdx of cols) {
      const col = columns[colIdx];
      const node = new DLXNode(col);
      node.rowId = rowId;
      
      node.D = col;
      node.U = col.U;
      col.U.D = node;
      col.U = node;
      col.size++;

      if (!firstNode) {
        firstNode = node;
      } else {
        node.R = firstNode;
        node.L = firstNode.L;
        firstNode.L.R = node;
        firstNode.L = node;
      }
    }
  };

  // Precompute cell to region mapping
  const cellToRegion = new Array(81).fill(0);
  if (regions) {
    for (let rId = 0; rId < 9; rId++) {
      for (const cellIdx of regions[rId]) {
        cellToRegion[cellIdx] = rId;
      }
    }
  } else {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        cellToRegion[r * 9 + c] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      }
    }
  }

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const idx = r * 9 + c;
      const val = grid[idx];
      const startV = val === 0 ? 1 : val;
      const endV = val === 0 ? 9 : val;

      for (let v = startV; v <= endV; v++) {
        const regionIndex = cellToRegion[idx];
        const cellConstr = idx;
        const rowConstr = 81 + r * 9 + (v - 1);
        const colConstr = 162 + c * 9 + (v - 1);
        const boxConstr = 243 + regionIndex * 9 + (v - 1);
        
        const rowId = (r * 81) + (c * 9) + (v - 1);
        addRow(rowId, [cellConstr, rowConstr, colConstr, boxConstr]);
      }
    }
  }

  return header;
};

const cover = (col) => {
  col.R.L = col.L;
  col.L.R = col.R;
  for (let i = col.D; i !== col; i = i.D) {
    for (let j = i.R; j !== i; j = j.R) {
      j.D.U = j.U;
      j.U.D = j.D;
      j.C.size--;
    }
  }
};

const uncover = (col) => {
  for (let i = col.U; i !== col; i = i.U) {
    for (let j = i.L; j !== i; j = j.L) {
      j.C.size++;
      j.D.U = j;
      j.U.D = j;
    }
  }
  col.R.L = col;
  col.L.R = col;
};

const solveDLX = (header, limit = 1) => {
  const solutions = [];
  const currentSolution = [];

  const search = () => {
    if (header.R === header) {
      solutions.push([...currentSolution]);
      return solutions.length >= limit;
    }

    let col = null;
    let minSize = Infinity;
    for (let c = header.R; c !== header; c = c.R) {
      if (c.size < minSize) {
        minSize = c.size;
        col = c;
      }
    }

    if (minSize === 0) return false;

    cover(col);

    for (let r = col.D; r !== col; r = r.D) {
      currentSolution.push(r.rowId);
      for (let j = r.R; j !== r; j = j.R) {
        cover(j.C);
      }

      if (search()) return true;

      for (let j = r.L; j !== r; j = j.L) {
        uncover(j.C);
      }
      currentSolution.pop();
    }

    uncover(col);
    return false;
  };

  search();
  return solutions;
};

const decodeSolution = (rowIds) => {
  const grid = new Array(81).fill(0);
  for (const rowId of rowIds) {
    const v = (rowId % 9) + 1;
    const c = Math.floor(rowId / 9) % 9;
    const r = Math.floor(rowId / 81);
    grid[r * 9 + c] = v;
  }
  return grid;
};

export const solve = (grid, regions = null) => {
  const header = buildDLX(grid, regions);
  const solutions = solveDLX(header, 1);
  return solutions.length > 0 ? decodeSolution(solutions[0]) : null;
};

export const hasUniqueSolution = (grid, regions = null) => {
  const header = buildDLX(grid, regions);
  const solutions = solveDLX(header, 2);
  return solutions.length === 1;
};
