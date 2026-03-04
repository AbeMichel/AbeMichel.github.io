/**
 * Sudoku Generator
 *
 * Difficulty levels map to the Sudokis.com strategy table:
 *   easy       → Easy 1–10    (Direct Rule only)
 *   medium     → Medium 1–10  (+ Hidden Single)
 *   difficult  → Difficult 1–10 (+ Naked/Hidden Pairs/Triples/Foursomes, House Interactions, X-Wing)
 *   very       → Very Difficult 1–10 (+ XY/XYZ Wings/Chains, Swordfish, Jellyfish, X-Chain, WXYZ/VWXYZ)
 *   extreme    → Extremely Difficult 1–12 (+ General Chains, Brute Force)
 *
 * The generator works by:
 *   1. Filling a complete valid board using a seeded PRNG.
 *   2. Removing clues one at a time while ensuring the puzzle remains uniquely
 *      solvable using ONLY the techniques permitted for the chosen difficulty.
 *   3. Returning the board as a 9×9 array where 0 = empty, 1–9 = fixed clue.
 */

// ---------------------------------------------------------------------------
// Seeded PRNG (Mulberry32)
// ---------------------------------------------------------------------------
function createRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------
function emptyBoard() {
  return Array.from({ length: 9 }, () => new Array(9).fill(0));
}

function cloneBoard(b) {
  return b.map(r => r.slice());
}

function peers(r, c) {
  const set = new Set();
  for (let i = 0; i < 9; i++) {
    set.add(`${r},${i}`);
    set.add(`${i},${c}`);
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++)
      set.add(`${br + dr},${bc + dc}`);
  set.delete(`${r},${c}`);
  return [...set].map(s => s.split(',').map(Number));
}

function isValid(board, r, c, v) {
  return peers(r, c).every(([pr, pc]) => board[pr][pc] !== v);
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------
function buildCandidates(board) {
  const cands = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set())
  );
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0)
        for (let v = 1; v <= 9; v++)
          if (isValid(board, r, c, v))
            cands[r][c].add(v);
  return cands;
}

function elimFromCands(cands, r, c, v) {
  cands[r][c].delete(v);
}

function setCandCell(cands, board, r, c, v) {
  board[r][c] = v;
  for (const [pr, pc] of peers(r, c))
    cands[pr][pc].delete(v);
  cands[r][c] = new Set();
}

// ---------------------------------------------------------------------------
// Solving Techniques
// ---------------------------------------------------------------------------

// Naked Single: a cell has only one candidate
function nakedSingle(board, cands) {
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 1) {
        const v = [...cands[r][c]][0];
        setCandCell(cands, board, r, c, v);
        return true;
      }
  return false;
}

// Hidden Single: in a house, a value appears in only one cell
function hiddenSingle(board, cands) {
  const houses = getHouses();
  for (const house of houses) {
    for (let v = 1; v <= 9; v++) {
      const cells = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(v));
      if (cells.length === 1) {
        const [r, c] = cells[0];
        setCandCell(cands, board, r, c, v);
        return true;
      }
    }
  }
  return false;
}

function getHouses() {
  const houses = [];
  for (let i = 0; i < 9; i++) {
    houses.push(Array.from({ length: 9 }, (_, j) => [i, j]));       // row
    houses.push(Array.from({ length: 9 }, (_, j) => [j, i]));       // col
    const br = Math.floor(i / 3) * 3, bc = (i % 3) * 3;
    const box = [];
    for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) box.push([br + dr, bc + dc]);
    houses.push(box);
  }
  return houses;
}

// Naked Subset (Pair / Triple / Foursome)
function nakedSubset(board, cands, size) {
  const houses = getHouses();
  let changed = false;
  for (const house of houses) {
    const empties = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].size > 0 && cands[r][c].size <= size);
    for (const combo of combinations(empties, size)) {
      const union = new Set();
      for (const [r, c] of combo) for (const v of cands[r][c]) union.add(v);
      if (union.size === size) {
        const comboSet = new Set(combo.map(([r, c]) => `${r},${c}`));
        for (const [r, c] of house) {
          if (board[r][c] !== 0 || comboSet.has(`${r},${c}`)) continue;
          for (const v of union) {
            if (cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
          }
        }
      }
    }
  }
  return changed;
}

// Hidden Subset (Pair / Triple / Foursome)
function hiddenSubset(board, cands, size) {
  const houses = getHouses();
  let changed = false;
  for (const house of houses) {
    const emptyCells = house.filter(([r, c]) => board[r][c] === 0);
    const valueCells = {};
    for (let v = 1; v <= 9; v++) {
      const cells = emptyCells.filter(([r, c]) => cands[r][c].has(v));
      if (cells.length >= 2 && cells.length <= size) valueCells[v] = cells;
    }
    const vals = Object.keys(valueCells).map(Number);
    for (const vCombo of combinations(vals, size)) {
      const allCells = new Set();
      for (const v of vCombo) for (const [r, c] of valueCells[v]) allCells.add(`${r},${c}`);
      if (allCells.size === size) {
        const vSet = new Set(vCombo);
        for (const key of allCells) {
          const [r, c] = key.split(',').map(Number);
          for (const v of [...cands[r][c]]) {
            if (!vSet.has(v)) { cands[r][c].delete(v); changed = true; }
          }
        }
      }
    }
  }
  return changed;
}

// Interaction (Row/Col ↔ Block)
function interaction(board, cands) {
  let changed = false;
  // For each block, check if a value is confined to one row or one column
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      for (let v = 1; v <= 9; v++) {
        const cells = [];
        for (let dr = 0; dr < 3; dr++)
          for (let dc = 0; dc < 3; dc++) {
            const r = br * 3 + dr, c = bc * 3 + dc;
            if (board[r][c] === 0 && cands[r][c].has(v)) cells.push([r, c]);
          }
        if (cells.length < 2) continue;
        const rows = [...new Set(cells.map(([r]) => r))];
        const cols = [...new Set(cells.map(([, c]) => c))];
        if (rows.length === 1) {
          // eliminate from rest of row
          const row = rows[0];
          const blockCols = new Set(cells.map(([, c]) => c));
          for (let c = 0; c < 9; c++) {
            if (blockCols.has(c) || board[row][c] !== 0) continue;
            if (cands[row][c].has(v)) { cands[row][c].delete(v); changed = true; }
          }
        }
        if (cols.length === 1) {
          const col = cols[0];
          const blockRows = new Set(cells.map(([r]) => r));
          for (let r = 0; r < 9; r++) {
            if (blockRows.has(r) || board[r][col] !== 0) continue;
            if (cands[r][col].has(v)) { cands[r][col].delete(v); changed = true; }
          }
        }
      }
    }
  }
  // Reverse: row/col confined to block
  for (let i = 0; i < 9; i++) {
    for (let v = 1; v <= 9; v++) {
      // Row i
      const rowCells = [];
      for (let c = 0; c < 9; c++) if (board[i][c] === 0 && cands[i][c].has(v)) rowCells.push([i, c]);
      if (rowCells.length >= 2) {
        const bcs = [...new Set(rowCells.map(([, c]) => Math.floor(c / 3)))];
        if (bcs.length === 1) {
          const bc = bcs[0];
          const br = Math.floor(i / 3);
          const rowSet = new Set(rowCells.map(([, c]) => c));
          for (let dr = 0; dr < 3; dr++) {
            const r2 = br * 3 + dr;
            if (r2 === i) continue;
            for (let dc = 0; dc < 3; dc++) {
              const c2 = bc * 3 + dc;
              if (board[r2][c2] === 0 && cands[r2][c2].has(v)) { cands[r2][c2].delete(v); changed = true; }
            }
          }
        }
      }
      // Col i
      const colCells = [];
      for (let r = 0; r < 9; r++) if (board[r][i] === 0 && cands[r][i].has(v)) colCells.push([r, i]);
      if (colCells.length >= 2) {
        const brs = [...new Set(colCells.map(([r]) => Math.floor(r / 3)))];
        if (brs.length === 1) {
          const br = brs[0];
          const bc = Math.floor(i / 3);
          const colRowSet = new Set(colCells.map(([r]) => r));
          for (let dc = 0; dc < 3; dc++) {
            const c2 = bc * 3 + dc;
            if (c2 === i) continue;
            for (let dr = 0; dr < 3; dr++) {
              const r2 = br * 3 + dr;
              if (board[r2][c2] === 0 && cands[r2][c2].has(v)) { cands[r2][c2].delete(v); changed = true; }
            }
          }
        }
      }
    }
  }
  return changed;
}

// X-Wing
function xWing(board, cands) {
  let changed = false;
  for (let v = 1; v <= 9; v++) {
    // Rows → eliminate from columns
    const rowData = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) if (board[r][c] === 0 && cands[r][c].has(v)) cols.push(c);
      if (cols.length === 2) rowData.push({ r, cols });
    }
    for (let i = 0; i < rowData.length; i++)
      for (let j = i + 1; j < rowData.length; j++) {
        if (rowData[i].cols[0] === rowData[j].cols[0] && rowData[i].cols[1] === rowData[j].cols[1]) {
          const [c1, c2] = rowData[i].cols;
          const rows = new Set([rowData[i].r, rowData[j].r]);
          for (let r = 0; r < 9; r++) {
            if (rows.has(r)) continue;
            for (const c of [c1, c2]) {
              if (board[r][c] === 0 && cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
            }
          }
        }
      }
    // Cols → eliminate from rows
    const colData = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) if (board[r][c] === 0 && cands[r][c].has(v)) rows.push(r);
      if (rows.length === 2) colData.push({ c, rows });
    }
    for (let i = 0; i < colData.length; i++)
      for (let j = i + 1; j < colData.length; j++) {
        if (colData[i].rows[0] === colData[j].rows[0] && colData[i].rows[1] === colData[j].rows[1]) {
          const [r1, r2] = colData[i].rows;
          const cols = new Set([colData[i].c, colData[j].c]);
          for (let c = 0; c < 9; c++) {
            if (cols.has(c)) continue;
            for (const r of [r1, r2]) {
              if (board[r][c] === 0 && cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
            }
          }
        }
      }
  }
  return changed;
}

// Swordfish
function swordfish(board, cands) {
  let changed = false;
  for (let v = 1; v <= 9; v++) {
    // Row-based
    const rowData = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) if (board[r][c] === 0 && cands[r][c].has(v)) cols.push(c);
      if (cols.length >= 2 && cols.length <= 3) rowData.push({ r, cols });
    }
    for (const combo of combinations(rowData, 3)) {
      const allCols = [...new Set(combo.flatMap(d => d.cols))];
      if (allCols.length === 3) {
        const rows = new Set(combo.map(d => d.r));
        const colSet = new Set(allCols);
        for (let r = 0; r < 9; r++) {
          if (rows.has(r)) continue;
          for (const c of colSet) {
            if (board[r][c] === 0 && cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
          }
        }
      }
    }
    // Col-based
    const colData = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) if (board[r][c] === 0 && cands[r][c].has(v)) rows.push(r);
      if (rows.length >= 2 && rows.length <= 3) colData.push({ c, rows });
    }
    for (const combo of combinations(colData, 3)) {
      const allRows = [...new Set(combo.flatMap(d => d.rows))];
      if (allRows.length === 3) {
        const cols = new Set(combo.map(d => d.c));
        const rowSet = new Set(allRows);
        for (let c = 0; c < 9; c++) {
          if (cols.has(c)) continue;
          for (const r of rowSet) {
            if (board[r][c] === 0 && cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
          }
        }
      }
    }
  }
  return changed;
}

// Jellyfish
function jellyfish(board, cands) {
  let changed = false;
  for (let v = 1; v <= 9; v++) {
    for (const [lineKey, crossKey] of [['r', 'c'], ['c', 'r']]) {
      const lineData = [];
      for (let i = 0; i < 9; i++) {
        const cross = [];
        for (let j = 0; j < 9; j++) {
          const r = lineKey === 'r' ? i : j;
          const c = lineKey === 'r' ? j : i;
          if (board[r][c] === 0 && cands[r][c].has(v)) cross.push(j);
        }
        if (cross.length >= 2 && cross.length <= 4) lineData.push({ i, cross });
      }
      for (const combo of combinations(lineData, 4)) {
        const allCross = [...new Set(combo.flatMap(d => d.cross))];
        if (allCross.length === 4) {
          const lineSet = new Set(combo.map(d => d.i));
          const crossSet = new Set(allCross);
          for (let j = 0; j < 9; j++) {
            if (crossSet.has(j)) continue;  // wait, we eliminate from cross lines not in lineSet
          }
          for (let j = 0; j < 9; j++) {
            if (lineSet.has(j)) continue;
            for (const cr of crossSet) {
              const r = lineKey === 'r' ? j : cr;
              const c = lineKey === 'r' ? cr : j;
              if (board[r][c] === 0 && cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
            }
          }
        }
      }
    }
  }
  return changed;
}

// XY-Wing: pivot has 2 candidates (XY), two pincers share one candidate each (XZ, YZ)
function xyWing(board, cands) {
  let changed = false;
  const bivalue = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

  for (const [pr, pc] of bivalue) {
    const [x, y] = [...cands[pr][pc]];
    const pivotPeers = peers(pr, pc);
    // find pincers
    const pincerXZ = bivalue.filter(([r, c]) => {
      if (r === pr && c === pc) return false;
      return pivotPeers.some(([pr2, pc2]) => pr2 === r && pc2 === c) && cands[r][c].has(x) && !cands[r][c].has(y);
    });
    const pincerYZ = bivalue.filter(([r, c]) => {
      if (r === pr && c === pc) return false;
      return pivotPeers.some(([pr2, pc2]) => pr2 === r && pc2 === c) && cands[r][c].has(y) && !cands[r][c].has(x);
    });
    for (const [r1, c1] of pincerXZ) {
      const z1 = [...cands[r1][c1]].find(v => v !== x);
      for (const [r2, c2] of pincerYZ) {
        const z2 = [...cands[r2][c2]].find(v => v !== y);
        if (z1 !== z2) continue;
        const z = z1;
        // cells seen by both pincers
        const p1peers = new Set(peers(r1, c1).map(([r, c]) => `${r},${c}`));
        for (const [r, c] of peers(r2, c2)) {
          if (!p1peers.has(`${r},${c}`)) continue;
          if (board[r][c] === 0 && cands[r][c].has(z)) { cands[r][c].delete(z); changed = true; }
        }
      }
    }
  }
  return changed;
}

// XYZ-Wing
function xyzWing(board, cands) {
  let changed = false;
  const trivalue = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 3) trivalue.push([r, c]);

  const bivalue = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

  for (const [pr, pc] of trivalue) {
    const xyz = [...cands[pr][pc]];
    const pivotPeers = peers(pr, pc);
    for (const combo of combinations(bivalue.filter(([r, c]) => pivotPeers.some(([r2, c2]) => r2 === r && c2 === c)), 2)) {
      const [[r1, c1], [r2, c2]] = combo;
      const all = new Set([...xyz, ...cands[r1][c1], ...cands[r2][c2]]);
      if (all.size !== 3) continue;
      const shared = [...cands[r1][c1]].filter(v => cands[r2][c2].has(v) && cands[pr][pc].has(v));
      if (shared.length !== 1) continue;
      const z = shared[0];
      const p1peers = new Set(peers(r1, c1).map(([r, c]) => `${r},${c}`));
      const p2peers = new Set(peers(r2, c2).map(([r, c]) => `${r},${c}`));
      for (const [r, c] of pivotPeers) {
        if (!p1peers.has(`${r},${c}`) || !p2peers.has(`${r},${c}`)) continue;
        if (board[r][c] === 0 && cands[r][c].has(z)) { cands[r][c].delete(z); changed = true; }
      }
    }
  }
  return changed;
}

// X-Chain
function xChain(board, cands) {
  let changed = false;
  for (let v = 1; v <= 9; v++) {
    // Build strong links (conjugate pairs in a house)
    const strongLinks = [];
    for (const house of getHouses()) {
      const cells = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(v));
      if (cells.length === 2) strongLinks.push(cells);
    }
    // Build adjacency: cell -> [connected cells via strong link]
    const adj = {};
    const key = (r, c) => `${r},${c}`;
    for (const [a, b] of strongLinks) {
      const ka = key(...a), kb = key(...b);
      (adj[ka] = adj[ka] || []).push(b);
      (adj[kb] = adj[kb] || []).push(a);
    }
    // BFS/DFS to find alternating chains. Color: 0=ON, 1=OFF
    // If two cells of same color see each other, eliminate from cells that see both ends of each chain
    const cells = Object.keys(adj).map(k => k.split(',').map(Number));
    const visited = new Set();
    for (const start of cells) {
      if (visited.has(key(...start))) continue;
      // BFS coloring
      const color = {};
      const queue = [[start, 0]];
      color[key(...start)] = 0;
      while (queue.length) {
        const [cell, col] = queue.shift();
        visited.add(key(...cell));
        for (const nb of (adj[key(...cell)] || [])) {
          const nk = key(...nb);
          if (color[nk] === undefined) {
            color[nk] = 1 - col;
            queue.push([nb, 1 - col]);
          }
        }
      }
      const on = Object.entries(color).filter(([, c]) => c === 0).map(([k]) => k.split(',').map(Number));
      const off = Object.entries(color).filter(([, c]) => c === 1).map(([k]) => k.split(',').map(Number));
      // Any cell that sees both an ON and an OFF cell => eliminate v
      for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
          if (board[r][c] !== 0 || !cands[r][c].has(v)) continue;
          const seesOn = on.some(([r2, c2]) => peers(r, c).some(([pr, pc]) => pr === r2 && pc === c2));
          const seesOff = off.some(([r2, c2]) => peers(r, c).some(([pr, pc]) => pr === r2 && pc === c2));
          if (seesOn && seesOff) { cands[r][c].delete(v); changed = true; }
        }
    }
  }
  return changed;
}

// XY-Chain (bivalue chains)
function xyChain(board, cands) {
  let changed = false;
  const bivalue = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

  const key = (r, c) => `${r},${c}`;
  // For each bivalue cell as start, do DFS along bivalue chains
  for (const [sr, sc] of bivalue) {
    for (const startV of cands[sr][sc]) {
      const endV = [...cands[sr][sc]].find(v => v !== startV);
      // DFS: track chain, current cell, current "must match" value for next link
      const stack = [{ r: sr, c: sc, mustMatch: endV, chain: [key(sr, sc)], enterWith: startV }];
      while (stack.length) {
        const { r, c, mustMatch, chain, enterWith } = stack.pop();
        for (const [nr, nc] of peers(r, c)) {
          if (board[nr][nc] !== 0 || cands[nr][nc].size !== 2) continue;
          if (!cands[nr][nc].has(mustMatch)) continue;
          const nk = key(nr, nc);
          if (chain.includes(nk)) continue;
          const nextV = [...cands[nr][nc]].find(v => v !== mustMatch);
          const newChain = [...chain, nk];
          // If end value equals start value and chain length >= 3, we have a valid chain
          if (nextV === startV && newChain.length >= 3) {
            // eliminate startV from cells that see both start and end
            const startPeers = new Set(peers(sr, sc).map(([r2, c2]) => key(r2, c2)));
            for (const [er, ec] of peers(nr, nc)) {
              if (!startPeers.has(key(er, ec))) continue;
              if (board[er][ec] === 0 && cands[er][ec].has(startV)) { cands[er][ec].delete(startV); changed = true; }
            }
          }
          stack.push({ r: nr, c: nc, mustMatch: nextV, chain: newChain, enterWith: mustMatch });
        }
      }
    }
  }
  return changed;
}

// WXYZ-Wing (basic: 4-value pivot with 2-value pincers seeing pivot)
function wxyzWing(board, cands) {
  let changed = false;
  const quadvalue = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0 && cands[r][c].size >= 2 && cands[r][c].size <= 4) quadvalue.push([r, c]);

  for (const [pr, pc] of quadvalue) {
    const pivotPeers = peers(pr, pc);
    const peerCells = quadvalue.filter(([r, c]) =>
      (r !== pr || c !== pc) && pivotPeers.some(([r2, c2]) => r2 === r && c2 === c)
    );
    for (const combo of combinations(peerCells, 3)) {
      const allCells = [[pr, pc], ...combo];
      const allVals = new Set();
      for (const [r, c] of allCells) for (const v of cands[r][c]) allVals.add(v);
      if (allVals.size !== 4) continue;
      // Find restricted value: appears in only one cell outside pivot
      for (const z of allVals) {
        const cellsWithZ = allCells.filter(([r, c]) => cands[r][c].has(z));
        if (cellsWithZ.length < 2) continue;
        // If z appears in all cells of combo that have it, see if we can eliminate elsewhere
        // Cells seen by ALL cells containing z
        let seenByAll = null;
        for (const [r, c] of cellsWithZ) {
          const peerSet = new Set(peers(r, c).map(([r2, c2]) => `${r2},${c2}`));
          if (seenByAll === null) { seenByAll = peerSet; }
          else { for (const k of seenByAll) if (!peerSet.has(k)) seenByAll.delete(k); }
        }
        if (!seenByAll) continue;
        for (const key of seenByAll) {
          const [r, c] = key.split(',').map(Number);
          if (allCells.some(([r2, c2]) => r2 === r && c2 === c)) continue;
          if (board[r][c] === 0 && cands[r][c].has(z)) { cands[r][c].delete(z); changed = true; }
        }
      }
    }
  }
  return changed;
}

// Naked Single Chain (General Chain / Brute Force assisted)
// Try each candidate for a cell, solve with nakedSingle only, intersect results
function nakedSingleChain(board, cands) {
  let changed = false;
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0 || cands[r][c].size < 2) continue;
      const vals = [...cands[r][c]];
      let intersection = null;
      let anyContradiction = false;
      const contradictVals = [];
      for (const v of vals) {
        const tb = cloneBoard(board);
        const tc = cands.map(row => row.map(s => new Set(s)));
        setCandCell(tc, tb, r, c, v);
        let progress = true, contradiction = false;
        while (progress) {
          progress = false;
          for (let r2 = 0; r2 < 9; r2++) for (let c2 = 0; c2 < 9; c2++)
            if (tb[r2][c2] === 0 && tc[r2][c2].size === 0) { contradiction = true; break; }
          if (contradiction) break;
          if (nakedSingle(tb, tc)) progress = true;
        }
        if (contradiction) { contradictVals.push(v); anyContradiction = true; }
        else {
          const remaining = new Set();
          for (let r2 = 0; r2 < 9; r2++) for (let c2 = 0; c2 < 9; c2++)
            if (tb[r2][c2] !== 0) remaining.add(`${r2},${c2},${tb[r2][c2]}`);
          if (intersection === null) intersection = remaining;
          else for (const k of intersection) if (!remaining.has(k)) intersection.delete(k);
        }
      }
      // Eliminate contradiction values
      for (const v of contradictVals) {
        if (cands[r][c].has(v)) { cands[r][c].delete(v); changed = true; }
      }
      // Apply intersected certain values
      if (intersection) {
        for (const key of intersection) {
          const [r2, c2, v] = key.split(',').map(Number);
          if (board[r2][c2] === 0) { setCandCell(cands, board, r2, c2, v); changed = true; }
        }
      }
    }
  return changed;
}

// ---------------------------------------------------------------------------
// Utility: combinations
// ---------------------------------------------------------------------------
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const result = [];
  function helper(start, current) {
    if (current.length === k) { result.push([...current]); return; }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }
  helper(0, []);
  return result;
}

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------
const DIFFICULTY_CONFIG = {
  easy: {
    minClues: 36, maxClues: 50,
    techniques: ['nakedSingle'],
  },
  medium: {
    minClues: 28, maxClues: 35,
    techniques: ['nakedSingle', 'hiddenSingle'],
  },
  difficult: {
    minClues: 22, maxClues: 27,
    techniques: ['nakedSingle', 'hiddenSingle', 'interaction',
      'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple',
      'nakedFoursome', 'hiddenFoursome', 'xWing'],
  },
  very: {
    minClues: 17, maxClues: 21,
    techniques: ['nakedSingle', 'hiddenSingle', 'interaction',
      'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple',
      'nakedFoursome', 'hiddenFoursome',
      'xWing', 'xyWing', 'swordfish', 'xyzWing', 'xChain',
      'xyChain', 'jellyfish', 'wxyzWing'],
  },
  extreme: {
    minClues: 17, maxClues: 20,
    techniques: ['nakedSingle', 'hiddenSingle', 'interaction',
      'nakedPair', 'hiddenPair', 'nakedTriple', 'hiddenTriple',
      'nakedFoursome', 'hiddenFoursome',
      'xWing', 'xyWing', 'swordfish', 'xyzWing', 'xChain',
      'xyChain', 'jellyfish', 'wxyzWing', 'nakedSingleChain'],
  },
};

// ---------------------------------------------------------------------------
// Solver using only allowed techniques
// Returns { solved: bool, unique: bool } after attempting full solve
// ---------------------------------------------------------------------------
function solveWithTechniques(boardIn, allowedTechniques) {
  const board = cloneBoard(boardIn);
  const cands = buildCandidates(board);

  const techFns = {
    nakedSingle: (b, c) => nakedSingle(b, c),
    hiddenSingle: (b, c) => hiddenSingle(b, c),
    interaction: (b, c) => interaction(b, c),
    nakedPair: (b, c) => nakedSubset(b, c, 2),
    hiddenPair: (b, c) => hiddenSubset(b, c, 2),
    nakedTriple: (b, c) => nakedSubset(b, c, 3),
    hiddenTriple: (b, c) => hiddenSubset(b, c, 3),
    nakedFoursome: (b, c) => nakedSubset(b, c, 4),
    hiddenFoursome: (b, c) => hiddenSubset(b, c, 4),
    xWing: (b, c) => xWing(b, c),
    xyWing: (b, c) => xyWing(b, c),
    swordfish: (b, c) => swordfish(b, c),
    xyzWing: (b, c) => xyzWing(b, c),
    xChain: (b, c) => xChain(b, c),
    xyChain: (b, c) => xyChain(b, c),
    jellyfish: (b, c) => jellyfish(b, c),
    wxyzWing: (b, c) => wxyzWing(b, c),
    nakedSingleChain: (b, c) => nakedSingleChain(b, c),
  };

  let progress = true;
  while (progress) {
    progress = false;
    for (const t of allowedTechniques) {
      if (techFns[t] && techFns[t](board, cands)) { progress = true; break; }
    }
  }

  const solved = board.every(row => row.every(v => v !== 0));
  return { solved, board };
}

// Backtracking solver for uniqueness check (ignores technique constraints)
function countSolutions(board, limit = 2) {
  const empty = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) empty.push([r, c]);

  let count = 0;
  function bt(idx) {
    if (idx === empty.length) { count++; return count >= limit; }
    const [r, c] = empty[idx];
    for (let v = 1; v <= 9; v++) {
      if (!isValid(board, r, c, v)) continue;
      board[r][c] = v;
      if (bt(idx + 1)) return true;
      board[r][c] = 0;
    }
    return false;
  }
  bt(0);
  return count;
}

// ---------------------------------------------------------------------------
// Full board generator (backtracking + PRNG)
// ---------------------------------------------------------------------------
function generateFullBoard(rng) {
  const board = emptyBoard();
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  function bt(pos) {
    if (pos === 81) return true;
    const r = Math.floor(pos / 9), c = pos % 9;
    const vals = shuffle([...digits], rng);
    for (const v of vals) {
      if (!isValid(board, r, c, v)) continue;
      board[r][c] = v;
      if (bt(pos + 1)) return true;
      board[r][c] = 0;
    }
    return false;
  }
  bt(0);
  return board;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
/**
 * Generate a Sudoku puzzle.
 *
 * @param {string} difficulty - "easy" | "medium" | "difficult" | "very" | "extreme"
 * @param {number|string} seed - Any number or string used to seed the RNG
 * @returns {number[][]} 9×9 array; 0 = empty cell, 1–9 = given clue
 */
export function generate(difficulty, seed) {
  const normalised = (difficulty || 'medium').toLowerCase().trim();
  const config = DIFFICULTY_CONFIG[normalised] || DIFFICULTY_CONFIG.medium;

  const rng = createRng(typeof seed === 'number' ? seed : hashSeed(String(seed ?? 'default')));

  // 1. Generate a complete valid board
  const fullBoard = generateFullBoard(rng);

  // 2. Determine how many clues to keep
  const targetClues = config.minClues + Math.floor(rng() * (config.maxClues - config.minClues + 1));

  // 3. Remove clues while maintaining unique solvability with allowed techniques
  const puzzle = cloneBoard(fullBoard);
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9]),
    rng
  );

  let clues = 81;
  for (const [r, c] of positions) {
    if (clues <= targetClues) break;

    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    clues--;

    // Check: can this be solved with allowed techniques?
    const { solved } = solveWithTechniques(puzzle, config.techniques);

    if (!solved) {
      // Technique-solve failed; for non-extreme levels restore the clue
      if (normalised !== 'extreme') {
        puzzle[r][c] = backup;
        clues++;
      } else {
        // For extreme, also allow brute-force uniqueness check (fall through)
        const solutions = countSolutions(cloneBoard(puzzle));
        if (solutions !== 1) { puzzle[r][c] = backup; clues++; }
      }
    } else {
      // Verify uniqueness via brute force for harder levels to be safe
      if (normalised === 'difficult' || normalised === 'very' || normalised === 'extreme') {
        const solutions = countSolutions(cloneBoard(puzzle));
        if (solutions !== 1) { puzzle[r][c] = backup; clues++; }
      }
    }
  }

  return puzzle;
}
/**
 * Solve a puzzle board using backtracking.
 * Returns a solved 9×9 array, or null if unsolvable.
 * @param {number[][]} puzzle - 9×9 array where 0 = empty
 * @returns {number[][]|null}
 */
export function solve(puzzle) {
  const board = puzzle.map(r => r.slice());
  const empty = [];
  for (let r = 0; r < 9; r++)
    for (let c = 0; c < 9; c++)
      if (board[r][c] === 0) empty.push([r, c]);

  function bt(idx) {
    if (idx === empty.length) return true;
    const [r, c] = empty[idx];
    for (let v = 1; v <= 9; v++) {
      if (!isValid(board, r, c, v)) continue;
      board[r][c] = v;
      if (bt(idx + 1)) return true;
      board[r][c] = 0;
    }
    return false;
  }
  return bt(0) ? board : null;
}