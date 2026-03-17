import { TECHNIQUES, getTier } from '../config/techniques.js';

// --- Candidate Utilities ---
const getCandidates = (cells, regions) => {
  const cands = cells.map(cell => {
    if (cell.v) return new Set();
    if (cell.c && cell.c.length > 0) return new Set(cell.c);
    return new Set([1,2,3,4,5,6,7,8,9]);
  });

  const grid = cells.map(c => c.v);

  const getRegionCells = (idx) => {
    let rId = 0;
    if (regions) {
      for (let i = 0; i < 9; i++) {
        if (regions[i].includes(idx)) { rId = i; break; }
      }
      return regions[rId];
    }
    const r = Math.floor(idx / 9);
    const c = idx % 9;
    const br = Math.floor(r / 3) * 3;
    const bc = Math.floor(c / 3) * 3;
    const ids = [];
    for (let row = br; row < br + 3; row++) {
      for (let col = bc; col < bc + 3; col++) ids.push(row * 9 + col);
    }
    return ids;
  };

  const getRowCells = (idx) => {
    const r = Math.floor(idx / 9);
    return Array.from({length: 9}, (_, i) => r * 9 + i);
  };

  const getColCells = (idx) => {
    const c = idx % 9;
    return Array.from({length: 9}, (_, i) => i * 9 + c);
  };

  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;                  // filled — already cleared
    if (cells[i].c?.length > 0) continue;   // has stored candidates — trust them
    // Fresh compute for cells with no stored candidates
    const peers = new Set([...getRowCells(i), ...getColCells(i), ...getRegionCells(i)]);
    for (const p of peers) {
      if (grid[p]) cands[i].delete(grid[p]);
    }
  }
  return cands;
};

// --- Infrastructure Helpers ---

// Yields all k-length subsets of arr in lexicographic index order, no duplicates
function* combinations(arr, k) {
  if (k === 0) { yield []; return; }
  if (k > arr.length) return;
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest];
    }
  }
}

// Returns the 9 cell ids that share the same row as id (including id)
const rowPeers = (id) => {
  const r = Math.floor(id / 9);
  return Array.from({ length: 9 }, (_, c) => r * 9 + c);
};

// Returns the 9 cell ids that share the same column as id (including id)
const colPeers = (id) => {
  const c = id % 9;
  return Array.from({ length: 9 }, (_, r) => r * 9 + c);
};

// Returns the 9 cell ids that share the same box as id (including id)
const boxPeers = (id, regions) => {
  if (regions) {
    for (let rId = 0; rId < 9; rId++) {
      if (regions[rId].includes(id)) return regions[rId];
    }
  }
  const r = Math.floor(id / 9);
  const c = id % 9;
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  const ids = [];
  for (let row = br; row < br + 3; row++) {
    for (let col = bc; col < bc + 3; col++) ids.push(row * 9 + col);
  }
  return ids;
};

// Returns all peers of id (row ∪ col ∪ box) excluding id itself
const allPeers = (id, regions) => {
  const peers = new Set([...rowPeers(id), ...colPeers(id), ...boxPeers(id, regions)]);
  peers.delete(id);
  return [...peers];
};

// Returns all 27 units: 9 rows + 9 cols + 9 boxes as arrays of cell ids
const getAllUnits = (regions) => {
  const rows = Array.from({ length: 9 }, (_, r) => rowPeers(r * 9));
  const cols = Array.from({ length: 9 }, (_, c) => colPeers(c));
  const boxes = regions
    ? regions.slice()
    : Array.from({ length: 9 }, (_, i) => {
        const br = Math.floor(i / 3) * 3;
        const bc = (i % 3) * 3;
        const ids = [];
        for (let r = br; r < br + 3; r++)
          for (let c = bc; c < bc + 3; c++) ids.push(r * 9 + c);
        return ids;
      });
  return [...rows, ...cols, ...boxes];
};

// Returns true if cells idA and idB share a row, column, or box
const seesEachOther = (idA, idB, regions) => {
  if (idA === idB) return false;
  if (Math.floor(idA / 9) === Math.floor(idB / 9)) return true;
  if (idA % 9 === idB % 9) return true;
  return boxPeers(idA, regions).includes(idB);
};

// Returns eliminations array with duplicate {id, value} pairs removed
const dedupeElims = (eliminations) => {
  const seen = new Set();
  return eliminations.filter(({ id, value }) => {
    const key = `${id},${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// --- Techniques Implementations ---

// VERY_EASY
const findNakedSingle = (cands, cells) => {
  for (let i = 0; i < 81; i++) {
    if (cands[i].size === 1) {
      const val = [...cands[i]][0];
      return {
        techniqueId: 'NAKED_SINGLE',
        cellIds: [i],
        description: `Cell can only be ${val}.`,
        placement: { id: i, value: val },
        eliminations: null
      };
    }
  }
  return null;
};

// EASY
const findHiddenSingle = (cands, cells, regions) => {
  const checkGroups = (groups, name) => {
    for (const group of groups) {
      for (let v = 1; v <= 9; v++) {
        const possible = group.filter(i => cands[i].has(v));
        if (possible.length === 1) {
          return {
            techniqueId: 'HIDDEN_SINGLE',
            cellIds: [possible[0]],
            description: `Only cell in this ${name} that can be ${v}.`,
            placement: { id: possible[0], value: v },
            eliminations: null
          };
        }
      }
    }
    return null;
  };
  
  const rows = Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => r * 9 + c));
  const cols = Array.from({length: 9}, (_, c) => Array.from({length: 9}, (_, r) => r * 9 + c));
  const standardRegions = Array.from({length: 9}, (_, i) => {
    const r = Math.floor(i / 3) * 3;
    const c = (i % 3) * 3;
    const ids = [];
    for (let row = r; row < r + 3; row++) {
      for (let col = c; col < c + 3; col++) ids.push(row * 9 + col);
    }
    return ids;
  });
  
  return checkGroups(rows, 'row') || checkGroups(cols, 'column') || checkGroups(regions || standardRegions, 'region');
};

const findNakedSubset = (cands, cells, regions, size, techniqueId) => {
  const getCombos = (arr, k) => {
    if (k === 1) return arr.map(e => [e]);
    const combos = [];
    arr.forEach((e, idx) => {
      if (arr.length - idx >= k) {
        const tails = getCombos(arr.slice(idx + 1), k - 1);
        tails.forEach(t => combos.push([e, ...t]));
      }
    });
    return combos;
  };

  const checkGroups = (groups, name) => {
    for (const group of groups) {
      const unsolved = group.filter(i => cands[i].size > 0);
      if (unsolved.length <= size) continue;
      const combos = getCombos(unsolved, size);
      for (const combo of combos) {
        const union = new Set();
        combo.forEach(c => cands[c].forEach(v => union.add(v)));
        if (union.size === size) {
          const elims = [];
          for (const cell of group) {
            if (!combo.includes(cell) && cands[cell].size > 0) {
              const toRemove = [...cands[cell]].filter(v => union.has(v));
              if (toRemove.length > 0) {
                toRemove.forEach(v => elims.push({ id: cell, value: v }));
              }
            }
          }
          if (elims.length > 0) {
            return {
              techniqueId,
              cellIds: combo,
              description: `Naked ${size === 2 ? 'Pair' : size === 3 ? 'Triple' : 'Quad'} (${[...union].join(', ')}) in ${name} eliminates candidates.`,
              placement: null,
              eliminations: elims
            };
          }
        }
      }
    }
    return null;
  };

  const rows = Array.from({length: 9}, (_, r) => Array.from({length: 9}, (_, c) => r * 9 + c));
  const cols = Array.from({length: 9}, (_, c) => Array.from({length: 9}, (_, r) => r * 9 + c));
  const standardRegions = Array.from({length: 9}, (_, i) => {
    const r = Math.floor(i / 3) * 3;
    const c = (i % 3) * 3;
    const ids = [];
    for (let row = r; row < r + 3; row++) {
      for (let col = c; col < c + 3; col++) ids.push(row * 9 + col);
    }
    return ids;
  });
  return checkGroups(rows, 'row') || checkGroups(cols, 'column') || checkGroups(regions || standardRegions, 'region');
};

// EASY — Pointing Pair / Pointing Triple
// For each box, each digit: if all candidates lie in one row or col, eliminate from rest of that line.
const findPointingPairOrTriple = (cands, cells, regions, targetSize, techniqueId) => {
  const units = getAllUnits(regions);
  const boxes = units.slice(18); // units[0..8]=rows, [9..17]=cols, [18..26]=boxes

  for (const box of boxes) {
    for (let v = 1; v <= 9; v++) {
      const withV = box.filter(id => cands[id].has(v));
      if (withV.length !== targetSize) continue;

      // All in same row?
      const rows = new Set(withV.map(id => Math.floor(id / 9)));
      if (rows.size === 1) {
        const rowStart = [...rows][0] * 9;
        const elims = rowPeers(rowStart)
          .filter(id => !box.includes(id) && cands[id].has(v))
          .map(id => ({ id, value: v }));
        if (elims.length > 0) {
          return {
            techniqueId,
            cellIds: withV,
            placement: null,
            eliminations: elims,
            description: `${techniqueId.replace('_', ' ')}: ${v} confined to one row in box.`
          };
        }
      }

      // All in same column?
      const cols = new Set(withV.map(id => id % 9));
      if (cols.size === 1) {
        const col = [...cols][0];
        const elims = colPeers(col)
          .filter(id => !box.includes(id) && cands[id].has(v))
          .map(id => ({ id, value: v }));
        if (elims.length > 0) {
          return {
            techniqueId,
            cellIds: withV,
            placement: null,
            eliminations: elims,
            description: `${techniqueId.replace('_', ' ')}: ${v} confined to one column in box.`
          };
        }
      }
    }
  }
  return null;
};

// EASY — Box/Line Reduction
// For each row/col, each digit: if all candidates lie in one box, eliminate from rest of that box.
const findBoxLineReduction = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const lines = units.slice(0, 18); // rows and cols only

  for (const line of lines) {
    for (let v = 1; v <= 9; v++) {
      const withV = line.filter(id => cands[id].has(v));
      if (withV.length < 2) continue;

      // Check all candidates are in the same box
      const box0 = boxPeers(withV[0], regions);
      if (!withV.every(id => box0.includes(id))) continue;

      const elims = box0
        .filter(id => !line.includes(id) && cands[id].has(v))
        .map(id => ({ id, value: v }));
      if (elims.length > 0) {
        return {
          techniqueId: 'BOX_LINE_REDUCTION',
          cellIds: withV,
          placement: null,
          eliminations: elims,
          description: `Box/Line Reduction: ${v} in line confined to one box.`
        };
      }
    }
  }
  return null;
};

// EASY — Hidden Pair
// For each unit, find 2 values that appear only in the same 2 cells — eliminate all other candidates from those cells.
const findHiddenPair = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const unit of units) {
    const unsolved = unit.filter(id => cands[id].size > 0);
    for (const [a, b] of combinations(digits, 2)) {
      const withA = unsolved.filter(id => cands[id].has(a));
      const withB = unsolved.filter(id => cands[id].has(b));
      if (withA.length !== 2 || withB.length !== 2) continue;
      if (withA[0] !== withB[0] || withA[1] !== withB[1]) continue;

      const pair = withA;
      const elims = [];
      for (const id of pair) {
        for (const v of cands[id]) {
          if (v !== a && v !== b) elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'HIDDEN_PAIR',
          cellIds: pair,
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Hidden Pair (${a}, ${b}): eliminate other candidates from these two cells.`
        };
      }
    }
  }
  return null;
};

// EASY — Hidden Triple
// For each unit, find 3 values confined to the same 3 cells — eliminate all other candidates from those cells.
const findHiddenTriple = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  for (const unit of units) {
    const unsolved = unit.filter(id => cands[id].size > 0);
    for (const [a, b, c] of combinations(digits, 3)) {
      const withAny = unsolved.filter(id =>
        cands[id].has(a) || cands[id].has(b) || cands[id].has(c));
      if (withAny.length !== 3) continue;
      // Each digit must appear at least once (true triple, not degenerate pair)
      if (!withAny.some(id => cands[id].has(a))) continue;
      if (!withAny.some(id => cands[id].has(b))) continue;
      if (!withAny.some(id => cands[id].has(c))) continue;

      const elims = [];
      for (const id of withAny) {
        for (const v of cands[id]) {
          if (v !== a && v !== b && v !== c) elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'HIDDEN_TRIPLE',
          cellIds: withAny,
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Hidden Triple (${a}, ${b}, ${c}): eliminate other candidates from these three cells.`
        };
      }
    }
  }
  return null;
};

// MEDIUM — Hidden Quad
// For each unit, find 4 values confined to the same 4 cells — eliminate all other candidates from those cells.
const findHiddenQuad = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const unit of units) {
    const unsolved = unit.filter(id => cands[id].size > 0);
    for (const [a, b, c, d] of combinations(digits, 4)) {
      const withAny = unsolved.filter(id =>
        cands[id].has(a) || cands[id].has(b) || cands[id].has(c) || cands[id].has(d));
      if (withAny.length !== 4) continue;
      if (!withAny.some(id => cands[id].has(a))) continue;
      if (!withAny.some(id => cands[id].has(b))) continue;
      if (!withAny.some(id => cands[id].has(c))) continue;
      if (!withAny.some(id => cands[id].has(d))) continue;
      const elims = [];
      for (const id of withAny) {
        for (const v of cands[id]) {
          if (v !== a && v !== b && v !== c && v !== d) elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'HIDDEN_QUAD',
          cellIds: withAny,
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Hidden Quad (${a}, ${b}, ${c}, ${d}): eliminate other candidates from these four cells.`
        };
      }
    }
  }
  return null;
};

// MEDIUM — X-Wing
// For each digit: find 2 rows each with exactly 2 candidate cells in the same 2 columns → eliminate from those columns.
// Also scans columns × rows (transposed).
const findXWing = (cands, cells, regions) => {
  for (let v = 1; v <= 9; v++) {
    // Row scan: collect rows where v appears in exactly 2 columns
    const rowsWith2 = [];
    for (let r = 0; r < 9; r++) {
      const cs = [];
      for (let c = 0; c < 9; c++) { if (cands[r * 9 + c].has(v)) cs.push(c); }
      if (cs.length === 2) rowsWith2.push({ r, cs });
    }
    for (const [ra, rb] of combinations(rowsWith2, 2)) {
      if (ra.cs[0] !== rb.cs[0] || ra.cs[1] !== rb.cs[1]) continue;
      const [c1, c2] = ra.cs;
      const elims = [];
      for (let r = 0; r < 9; r++) {
        if (r === ra.r || r === rb.r) continue;
        if (cands[r * 9 + c1].has(v)) elims.push({ id: r * 9 + c1, value: v });
        if (cands[r * 9 + c2].has(v)) elims.push({ id: r * 9 + c2, value: v });
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'X_WING',
          cellIds: [ra.r * 9 + c1, ra.r * 9 + c2, rb.r * 9 + c1, rb.r * 9 + c2],
          placement: null,
          eliminations: dedupeElims(elims),
          description: `X-Wing on ${v}: eliminates ${v} from columns ${c1 + 1} and ${c2 + 1}.`
        };
      }
    }
    // Column scan: collect cols where v appears in exactly 2 rows
    const colsWith2 = [];
    for (let c = 0; c < 9; c++) {
      const rs = [];
      for (let r = 0; r < 9; r++) { if (cands[r * 9 + c].has(v)) rs.push(r); }
      if (rs.length === 2) colsWith2.push({ c, rs });
    }
    for (const [ca, cb] of combinations(colsWith2, 2)) {
      if (ca.rs[0] !== cb.rs[0] || ca.rs[1] !== cb.rs[1]) continue;
      const [r1, r2] = ca.rs;
      const elims = [];
      for (let c = 0; c < 9; c++) {
        if (c === ca.c || c === cb.c) continue;
        if (cands[r1 * 9 + c].has(v)) elims.push({ id: r1 * 9 + c, value: v });
        if (cands[r2 * 9 + c].has(v)) elims.push({ id: r2 * 9 + c, value: v });
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'X_WING',
          cellIds: [r1 * 9 + ca.c, r2 * 9 + ca.c, r1 * 9 + cb.c, r2 * 9 + cb.c],
          placement: null,
          eliminations: dedupeElims(elims),
          description: `X-Wing on ${v}: eliminates ${v} from rows ${r1 + 1} and ${r2 + 1}.`
        };
      }
    }
  }
  return null;
};

// MEDIUM — XY-Wing
// Bivalue pivot P={x,y}; wing W1 sees P with {x,z}; wing W2 sees P with {y,z}.
// Eliminate z from cells seeing both W1 and W2.
const findXYWing = (cands, cells, regions) => {
  for (let p = 0; p < 81; p++) {
    if (cands[p].size !== 2) continue;
    const [x, y] = [...cands[p]];
    const pivotPeers = allPeers(p, regions);
    const bivalPeers = pivotPeers.filter(id => cands[id].size === 2);
    // W1: has x, not y → other candidate is z
    const w1s = bivalPeers.filter(id => cands[id].has(x) && !cands[id].has(y));
    // W2: has y, not x → other candidate must match z from W1
    const w2s = bivalPeers.filter(id => cands[id].has(y) && !cands[id].has(x));
    for (const w1 of w1s) {
      const z = [...cands[w1]].find(v => v !== x);
      const validW2s = w2s.filter(id => cands[id].has(z));
      for (const w2 of validW2s) {
        const w1PeerSet = new Set(allPeers(w1, regions));
        const elims = [];
        for (let id = 0; id < 81; id++) {
          if (id === p || id === w1 || id === w2) continue;
          if (w1PeerSet.has(id) && seesEachOther(id, w2, regions) && cands[id].has(z)) {
            elims.push({ id, value: z });
          }
        }
        if (elims.length > 0) {
          return {
            techniqueId: 'XY_WING',
            cellIds: [p, w1, w2],
            placement: null,
            eliminations: dedupeElims(elims),
            description: `XY-Wing: eliminate ${z} from cells seeing both wing cells.`
          };
        }
      }
    }
  }
  return null;
};

// MEDIUM — XYZ-Wing
// Trivalue pivot P={x,y,z}; bivalue W1 sees P with {x,z}; bivalue W2 sees P with {y,z}.
// Eliminate z from cells seeing P, W1, AND W2.
const findXYZWing = (cands, cells, regions) => {
  for (let p = 0; p < 81; p++) {
    if (cands[p].size !== 3) continue;
    const pivotVals = [...cands[p]];
    const pivotPeers = allPeers(p, regions);
    const bivalPeers = pivotPeers.filter(id => cands[id].size === 2);
    // Try each of P's 3 values as the shared elimination value z
    for (const sharedZ of pivotVals) {
      const [va, vb] = pivotVals.filter(v => v !== sharedZ);
      const w1s = bivalPeers.filter(id => cands[id].has(sharedZ) && cands[id].has(va));
      const w2s = bivalPeers.filter(id => cands[id].has(sharedZ) && cands[id].has(vb));
      for (const w1 of w1s) {
        for (const w2 of w2s) {
          if (w1 === w2) continue;
          const pPeerSet = new Set(allPeers(p, regions));
          const w1PeerSet = new Set(allPeers(w1, regions));
          const elims = [];
          for (let id = 0; id < 81; id++) {
            if (id === p || id === w1 || id === w2) continue;
            if (pPeerSet.has(id) && w1PeerSet.has(id) && seesEachOther(id, w2, regions) && cands[id].has(sharedZ)) {
              elims.push({ id, value: sharedZ });
            }
          }
          if (elims.length > 0) {
            return {
              techniqueId: 'XYZ_WING',
              cellIds: [p, w1, w2],
              placement: null,
              eliminations: dedupeElims(elims),
              description: `XYZ-Wing: eliminate ${sharedZ} from cells seeing all three cells.`
            };
          }
        }
      }
    }
  }
  return null;
};

// MEDIUM — Skyscraper
// For digit v: 2 rows each with exactly 2 candidate cells sharing 1 column (base).
// Unshared cells are roof cells — eliminate v from cells seeing both roof cells.
// Also checks column pairs (transposed).
const findSkyscraper = (cands, cells, regions) => {
  for (let v = 1; v <= 9; v++) {
    // Row-based
    const rowsWith2 = [];
    for (let r = 0; r < 9; r++) {
      const cs = [];
      for (let c = 0; c < 9; c++) { if (cands[r * 9 + c].has(v)) cs.push(c); }
      if (cs.length === 2) rowsWith2.push({ r, ids: [r * 9 + cs[0], r * 9 + cs[1]], cs });
    }
    for (const [ra, rb] of combinations(rowsWith2, 2)) {
      const sharedCols = ra.cs.filter(c => rb.cs.includes(c));
      if (sharedCols.length !== 1) continue;
      const baseCol = sharedCols[0];
      const roofA = ra.ids.find(id => id % 9 !== baseCol);
      const roofB = rb.ids.find(id => id % 9 !== baseCol);
      const roofAPeers = new Set(allPeers(roofA, regions));
      const elims = [];
      for (let id = 0; id < 81; id++) {
        if (id === roofA || id === roofB) continue;
        if (roofAPeers.has(id) && seesEachOther(id, roofB, regions) && cands[id].has(v)) {
          elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'SKYSCRAPER',
          cellIds: [...ra.ids, ...rb.ids],
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Skyscraper on ${v}.`
        };
      }
    }
    // Column-based
    const colsWith2 = [];
    for (let c = 0; c < 9; c++) {
      const rs = [];
      for (let r = 0; r < 9; r++) { if (cands[r * 9 + c].has(v)) rs.push(r); }
      if (rs.length === 2) colsWith2.push({ c, ids: [rs[0] * 9 + c, rs[1] * 9 + c], rs });
    }
    for (const [ca, cb] of combinations(colsWith2, 2)) {
      const sharedRows = ca.rs.filter(r => cb.rs.includes(r));
      if (sharedRows.length !== 1) continue;
      const baseRow = sharedRows[0];
      const roofA = ca.ids.find(id => Math.floor(id / 9) !== baseRow);
      const roofB = cb.ids.find(id => Math.floor(id / 9) !== baseRow);
      const roofAPeers = new Set(allPeers(roofA, regions));
      const elims = [];
      for (let id = 0; id < 81; id++) {
        if (id === roofA || id === roofB) continue;
        if (roofAPeers.has(id) && seesEachOther(id, roofB, regions) && cands[id].has(v)) {
          elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'SKYSCRAPER',
          cellIds: [...ca.ids, ...cb.ids],
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Skyscraper on ${v}.`
        };
      }
    }
  }
  return null;
};

// MEDIUM — Two-String Kite
// For digit v: a row string (2 cells) and col string (2 cells) share a box at one end (the joint).
// The free ends are the kite tips — eliminate v from cells seeing both tips.
const findTwoStringKite = (cands, cells, regions) => {
  for (let v = 1; v <= 9; v++) {
    const rowStrings = [];
    for (let r = 0; r < 9; r++) {
      const ids = [];
      for (let c = 0; c < 9; c++) { if (cands[r * 9 + c].has(v)) ids.push(r * 9 + c); }
      if (ids.length === 2) rowStrings.push(ids);
    }
    const colStrings = [];
    for (let c = 0; c < 9; c++) {
      const ids = [];
      for (let r = 0; r < 9; r++) { if (cands[r * 9 + c].has(v)) ids.push(r * 9 + c); }
      if (ids.length === 2) colStrings.push(ids);
    }
    for (const [rA, rB] of rowStrings) {
      for (const [cA, cB] of colStrings) {
        // Try each pairing of row-end × col-end as the joint
        for (const [jointR, tipR, jointC, tipC] of [
          [rA, rB, cA, cB], [rA, rB, cB, cA],
          [rB, rA, cA, cB], [rB, rA, cB, cA]
        ]) {
          if (jointR === jointC) continue; // same cell — not a valid joint
          if (tipR === tipC) continue;     // tips are the same — not a kite
          if (!boxPeers(jointR, regions).includes(jointC)) continue; // joint must share a box
          const tipRPeers = new Set(allPeers(tipR, regions));
          const elims = [];
          for (let id = 0; id < 81; id++) {
            if (id === rA || id === rB || id === cA || id === cB) continue;
            if (tipRPeers.has(id) && seesEachOther(id, tipC, regions) && cands[id].has(v)) {
              elims.push({ id, value: v });
            }
          }
          if (elims.length > 0) {
            return {
              techniqueId: 'TWO_STRING_KITE',
              cellIds: [rA, rB, cA, cB],
              placement: null,
              eliminations: dedupeElims(elims),
              description: `Two-String Kite on ${v}.`
            };
          }
        }
      }
    }
  }
  return null;
};

// ── Tier 4 HARD Checkers ──────────────────────────────────────────────────────

// SWORDFISH / JELLYFISH — shared implementation parameterised by size (3 or 4)
const findSwordfishOrJellyfish = (cands, cells, regions, size, techniqueId) => {
  for (let v = 1; v <= 9; v++) {
    // Row scan: rows where v has 2..size candidates
    const rowData = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r * 9 + c].has(v)) cols.push(c);
      }
      if (cols.length >= 2 && cols.length <= size) rowData.push({ row: r, cols });
    }
    for (const subset of combinations(rowData, size)) {
      const colUnion = new Set(subset.flatMap(d => d.cols));
      if (colUnion.size !== size) continue;
      const rows = subset.map(d => d.row);
      const elims = [];
      for (const col of colUnion) {
        for (let r = 0; r < 9; r++) {
          if (rows.includes(r)) continue;
          const id = r * 9 + col;
          if (cands[id].has(v)) elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId,
          cellIds: subset.flatMap(d => d.cols.map(c => d.row * 9 + c)),
          eliminations: dedupeElims(elims),
          description: `${techniqueId} on ${v}.`
        };
      }
    }

    // Column scan: cols where v has 2..size candidates
    const colData = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r * 9 + c].has(v)) rows.push(r);
      }
      if (rows.length >= 2 && rows.length <= size) colData.push({ col: c, rows });
    }
    for (const subset of combinations(colData, size)) {
      const rowUnion = new Set(subset.flatMap(d => d.rows));
      if (rowUnion.size !== size) continue;
      const cols = subset.map(d => d.col);
      const elims = [];
      for (const row of rowUnion) {
        for (let c = 0; c < 9; c++) {
          if (cols.includes(c)) continue;
          const id = row * 9 + c;
          if (cands[id].has(v)) elims.push({ id, value: v });
        }
      }
      if (elims.length > 0) {
        return {
          techniqueId,
          cellIds: subset.flatMap(d => d.rows.map(r => r * 9 + d.col)),
          eliminations: dedupeElims(elims),
          description: `${techniqueId} on ${v}.`
        };
      }
    }
  }
  return null;
};

const findSwordfish = (cands, cells, regions) =>
  findSwordfishOrJellyfish(cands, cells, regions, 3, 'SWORDFISH');

const findJellyfish = (cands, cells, regions) =>
  findSwordfishOrJellyfish(cands, cells, regions, 4, 'JELLYFISH');

// W_WING
// Two bivalue cells C1 and C2 with identical candidates {a, b} that do not see each other.
// A strong link on `linkDigit` (unit with exactly 2 candidates, one being C1 or C2)
// whose other end sees the opposite bivalue cell → eliminate the other digit from
// all cells that see both C1 and C2.
const findWWing = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const bivalue = [];
  for (let id = 0; id < 81; id++) {
    if (cands[id].size === 2) bivalue.push(id);
  }
  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const c1 = bivalue[i], c2 = bivalue[j];
      const arr1 = Array.from(cands[c1]).sort((x, y) => x - y);
      const arr2 = Array.from(cands[c2]).sort((x, y) => x - y);
      if (arr1[0] !== arr2[0] || arr1[1] !== arr2[1]) continue;
      if (seesEachOther(c1, c2, regions)) continue;
      const [a, b] = arr1;
      for (const linkDigit of [a, b]) {
        const elimDigit = linkDigit === a ? b : a;
        for (const [pivot, other] of [[c1, c2], [c2, c1]]) {
          for (const unit of units) {
            const inUnit = unit.filter(id => cands[id].has(linkDigit));
            if (inUnit.length !== 2 || !inUnit.includes(pivot)) continue;
            const c3 = inUnit.find(id => id !== pivot);
            if (!seesEachOther(c3, other, regions)) continue;
            const elims = [];
            for (let id = 0; id < 81; id++) {
              if (id === c1 || id === c2) continue;
              if (cands[id].has(elimDigit) && seesEachOther(id, c1, regions) && seesEachOther(id, c2, regions)) {
                elims.push({ id, value: elimDigit });
              }
            }
            if (elims.length > 0) {
              return {
                techniqueId: 'W_WING',
                cellIds: [c1, c2, c3],
                eliminations: dedupeElims(elims),
                description: `W-Wing: {${a},${b}} in cells ${c1} and ${c2}, strong link on ${linkDigit} via ${c3}, eliminate ${elimDigit}.`
              };
            }
          }
        }
      }
    }
  }
  return null;
};

// EMPTY_RECTANGLE
// In a box, if all v-candidates lie on row R_er OR column C_er (the ER pattern),
// a conjugate pair for v with one end in R_er (col scan) or one end in C_er (row scan)
// forces an elimination at the intersection of the pair's other end and the ER line.
const findEmptyRectangle = (cands, cells, regions) => {
  for (let v = 1; v <= 9; v++) {
    for (let box = 0; box < 9; box++) {
      const boxRow = Math.floor(box / 3) * 3;
      const boxCol = (box % 3) * 3;

      const boxCands = [];
      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const id = (boxRow + dr) * 9 + (boxCol + dc);
          if (cands[id].has(v)) boxCands.push({ id, row: boxRow + dr, col: boxCol + dc });
        }
      }
      if (boxCands.length < 2) continue;

      for (let dr = 0; dr < 3; dr++) {
        for (let dc = 0; dc < 3; dc++) {
          const R_er = boxRow + dr;
          const C_er = boxCol + dc;
          if (!boxCands.every(c => c.row === R_er || c.col === C_er)) continue;
          // Skip degenerate cases where all candidates share a single row or column
          // (those are already handled by pointing pair / box line reduction)
          const hasColArm = boxCands.some(c => c.col === C_er && c.row !== R_er);
          const hasRowArm = boxCands.some(c => c.row === R_er && c.col !== C_er);
          if (!hasColArm && !hasRowArm) continue;

          // Column scan: find col C' outside box with exactly 2 v-candidates, one in row R_er
          for (let C_prime = 0; C_prime < 9; C_prime++) {
            if (C_prime >= boxCol && C_prime <= boxCol + 2) continue;
            const colCands = [];
            for (let r = 0; r < 9; r++) {
              if (cands[r * 9 + C_prime].has(v)) colCands.push(r);
            }
            if (colCands.length !== 2) continue;
            const [r1, r2] = colCands;
            let P2_row = r1 === R_er ? r2 : r2 === R_er ? r1 : null;
            if (P2_row === null) continue;
            if (P2_row >= boxRow && P2_row <= boxRow + 2) continue;
            const elimId = P2_row * 9 + C_er;
            if (cands[elimId].has(v)) {
              return {
                techniqueId: 'EMPTY_RECTANGLE',
                cellIds: [elimId, R_er * 9 + C_prime, P2_row * 9 + C_prime, ...boxCands.map(c => c.id)],
                eliminations: [{ id: elimId, value: v }],
                description: `Empty Rectangle on ${v} in box ${box}, eliminate from cell ${elimId}.`
              };
            }
          }

          // Row scan: find row R' outside box with exactly 2 v-candidates, one in col C_er
          for (let R_prime = 0; R_prime < 9; R_prime++) {
            if (R_prime >= boxRow && R_prime <= boxRow + 2) continue;
            const rowCands = [];
            for (let c = 0; c < 9; c++) {
              if (cands[R_prime * 9 + c].has(v)) rowCands.push(c);
            }
            if (rowCands.length !== 2) continue;
            const [c1, c2] = rowCands;
            let P2_col = c1 === C_er ? c2 : c2 === C_er ? c1 : null;
            if (P2_col === null) continue;
            if (P2_col >= boxCol && P2_col <= boxCol + 2) continue;
            const elimId = R_er * 9 + P2_col;
            if (cands[elimId].has(v)) {
              return {
                techniqueId: 'EMPTY_RECTANGLE',
                cellIds: [elimId, R_prime * 9 + C_er, R_prime * 9 + P2_col, ...boxCands.map(c => c.id)],
                eliminations: [{ id: elimId, value: v }],
                description: `Empty Rectangle on ${v} in box ${box}, eliminate from cell ${elimId}.`
              };
            }
          }
        }
      }
    }
  }
  return null;
};

// FINNED_X_WING
// Like X-Wing, but one base row (or col) has a single extra candidate (the fin) in the same
// box as one of its base corners. Eliminations are restricted to cells in the fin's box that
// lie in the base column (row scan) or base row (col scan).
const findFinnedXWing = (cands, cells, regions) => {
  for (let v = 1; v <= 9; v++) {
    // Row scan: rows with 2 or 3 v-candidates
    const rowData = [];
    for (let r = 0; r < 9; r++) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (cands[r * 9 + c].has(v)) cols.push(c);
      }
      if (cols.length === 2 || cols.length === 3) rowData.push({ r, cols });
    }
    for (const [rd1, rd2] of combinations(rowData, 2)) {
      const shared = rd1.cols.filter(c => rd2.cols.includes(c));
      if (shared.length !== 2) continue;
      const [C1, C2] = shared;
      for (const [baseRow, finRow] of [[rd1, rd2], [rd2, rd1]]) {
        if (baseRow.cols.length !== 2 || finRow.cols.length !== 3) continue;
        const Cfin = finRow.cols.find(c => c !== C1 && c !== C2);
        const finCellId = finRow.r * 9 + Cfin;
        const finBox = boxPeers(finCellId, regions);
        for (const baseCol of [C1, C2]) {
          if (!finBox.includes(finRow.r * 9 + baseCol)) continue;
          const elims = [];
          for (const id of finBox) {
            if (id % 9 !== baseCol) continue;
            const row = Math.floor(id / 9);
            if (row === baseRow.r || row === finRow.r) continue;
            if (cands[id].has(v)) elims.push({ id, value: v });
          }
          if (elims.length > 0) {
            return {
              techniqueId: 'FINNED_X_WING',
              cellIds: [baseRow.r*9+C1, baseRow.r*9+C2, finRow.r*9+C1, finRow.r*9+C2, finCellId],
              placement: null,
              eliminations: dedupeElims(elims),
              description: `Finned X-Wing on ${v}, fin at cell ${finCellId}.`
            };
          }
        }
      }
    }

    // Column scan: cols with 2 or 3 v-candidates
    const colData = [];
    for (let c = 0; c < 9; c++) {
      const rows = [];
      for (let r = 0; r < 9; r++) {
        if (cands[r * 9 + c].has(v)) rows.push(r);
      }
      if (rows.length === 2 || rows.length === 3) colData.push({ c, rows });
    }
    for (const [cd1, cd2] of combinations(colData, 2)) {
      const shared = cd1.rows.filter(r => cd2.rows.includes(r));
      if (shared.length !== 2) continue;
      const [R1, R2] = shared;
      for (const [baseCol, finCol] of [[cd1, cd2], [cd2, cd1]]) {
        if (baseCol.rows.length !== 2 || finCol.rows.length !== 3) continue;
        const Rfin = finCol.rows.find(r => r !== R1 && r !== R2);
        const finCellId = Rfin * 9 + finCol.c;
        const finBox = boxPeers(finCellId, regions);
        for (const baseRow of [R1, R2]) {
          if (!finBox.includes(baseRow * 9 + finCol.c)) continue;
          const elims = [];
          for (const id of finBox) {
            if (Math.floor(id / 9) !== baseRow) continue;
            const col = id % 9;
            if (col === baseCol.c || col === finCol.c) continue;
            if (cands[id].has(v)) elims.push({ id, value: v });
          }
          if (elims.length > 0) {
            return {
              techniqueId: 'FINNED_X_WING',
              cellIds: [R1*9+baseCol.c, R2*9+baseCol.c, R1*9+finCol.c, R2*9+finCol.c, finCellId],
              placement: null,
              eliminations: dedupeElims(elims),
              description: `Finned X-Wing on ${v}, fin at cell ${finCellId}.`
            };
          }
        }
      }
    }
  }
  return null;
};

// UNIQUE_RECTANGLE
// Finds a rectangle of 4 cells (2 rows × 2 cols, spanning exactly 2 boxes, all unsolved)
// and applies Type 1 and Type 2 eliminations to prevent a deadly pattern.
const findUniqueRectangle = (cands, cells, regions) => {
  const getBoxId = (id) => Math.floor(Math.floor(id / 9) / 3) * 3 + Math.floor((id % 9) / 3);
  const indices = Array.from({ length: 9 }, (_, i) => i);

  for (const [r1, r2] of combinations(indices, 2)) {
    for (const [c1, c2] of combinations(indices, 2)) {
      const ids = [r1*9+c1, r1*9+c2, r2*9+c1, r2*9+c2];
      if (!ids.every(id => cands[id].size > 0)) continue;
      if (new Set(ids.map(getBoxId)).size !== 2) continue;

      for (let a = 1; a <= 9; a++) {
        for (let b = a + 1; b <= 9; b++) {
          // Type 1: exactly 3 cells are exactly {a,b}; 4th has {a,b} + extras
          const exactlyAB = ids.filter(id => cands[id].size === 2 && cands[id].has(a) && cands[id].has(b));
          if (exactlyAB.length === 3) {
            const fourth = ids.find(id => !exactlyAB.includes(id));
            if (cands[fourth].has(a) && cands[fourth].has(b) && cands[fourth].size > 2) {
              return {
                techniqueId: 'UNIQUE_RECTANGLE',
                cellIds: ids,
                placement: null,
                eliminations: [{ id: fourth, value: a }, { id: fourth, value: b }],
                description: `Unique Rectangle Type 1: eliminate ${a} and ${b} from cell ${fourth}.`
              };
            }
          }

          // Type 2: exactly 2 floors are exactly {a,b}; both roofs are {a,b,c} for same c
          const floors = ids.filter(id => cands[id].size === 2 && cands[id].has(a) && cands[id].has(b));
          if (floors.length === 2) {
            const roofs = ids.filter(id => !floors.includes(id));
            if (roofs.every(id => cands[id].has(a) && cands[id].has(b) && cands[id].size === 3)) {
              const extra0 = [...cands[roofs[0]]].find(v => v !== a && v !== b);
              const extra1 = [...cands[roofs[1]]].find(v => v !== a && v !== b);
              if (extra0 === extra1) {
                const c = extra0;
                const elims = [];
                for (let id = 0; id < 81; id++) {
                  if (roofs.includes(id)) continue;
                  if (cands[id].has(c) && seesEachOther(id, roofs[0], regions) && seesEachOther(id, roofs[1], regions)) {
                    elims.push({ id, value: c });
                  }
                }
                if (elims.length > 0) {
                  return {
                    techniqueId: 'UNIQUE_RECTANGLE',
                    cellIds: ids,
                    placement: null,
                    eliminations: dedupeElims(elims),
                    description: `Unique Rectangle Type 2: eliminate ${c} from cells seeing both roof cells.`
                  };
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
};

// COLORING (Simple Coloring)
// Builds a strong-link graph for each digit, colors each connected component with BFS,
// then applies:
//   Rule 1 — same-color conflict: two cells of the same color see each other →
//             eliminate v from all cells of that color.
//   Rule 2 — both-colors visible: any uncolored cell seeing one cell of each color →
//             eliminate v from that cell.
const findColoring = (cands, cells, regions) => {
  const units = getAllUnits(regions);

  for (let v = 1; v <= 9; v++) {
    // Build strong-link adjacency (unit with exactly 2 v-candidates)
    const adj = new Map();
    for (const unit of units) {
      const withV = unit.filter(id => cands[id].has(v));
      if (withV.length !== 2) continue;
      const [a, b] = withV;
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a).add(b);
      adj.get(b).add(a);
    }
    if (adj.size === 0) continue;

    const visited = new Set();

    for (const start of adj.keys()) {
      if (visited.has(start)) continue;

      // BFS — color this connected component
      const compColor = new Map();
      const queue = [start];
      compColor.set(start, 0);
      let qi = 0;
      while (qi < queue.length) {
        const cur = queue[qi++];
        visited.add(cur);
        for (const nb of adj.get(cur)) {
          if (!compColor.has(nb)) {
            compColor.set(nb, 1 - compColor.get(cur));
            queue.push(nb);
          }
        }
      }

      const color0 = [];
      const color1 = [];
      for (const [id, c] of compColor) {
        (c === 0 ? color0 : color1).push(id);
      }

      // Rule 1: same-color conflict → eliminate v from all cells of that color
      const hasConflict = (colorCells) => {
        for (let i = 0; i < colorCells.length; i++) {
          for (let j = i + 1; j < colorCells.length; j++) {
            if (seesEachOther(colorCells[i], colorCells[j], regions)) return true;
          }
        }
        return false;
      };

      for (const conflictColor of [color0, color1]) {
        if (!hasConflict(conflictColor)) continue;
        const elims = conflictColor.filter(id => cands[id].has(v)).map(id => ({ id, value: v }));
        if (elims.length > 0) {
          return {
            techniqueId: 'COLORING',
            cellIds: [...color0, ...color1],
            placement: null,
            eliminations: dedupeElims(elims),
            description: `Simple Coloring on ${v}: same-color conflict, eliminate from conflicting color.`
          };
        }
      }

      // Rule 2: uncolored cell seeing both colors → eliminate v
      const elims = [];
      for (let id = 0; id < 81; id++) {
        if (compColor.has(id) || !cands[id].has(v)) continue;
        const seesC0 = color0.some(c0 => seesEachOther(id, c0, regions));
        const seesC1 = color1.some(c1 => seesEachOther(id, c1, regions));
        if (seesC0 && seesC1) elims.push({ id, value: v });
      }
      if (elims.length > 0) {
        return {
          techniqueId: 'COLORING',
          cellIds: [...color0, ...color1],
          placement: null,
          eliminations: dedupeElims(elims),
          description: `Simple Coloring on ${v}: eliminate from cells seeing both colors.`
        };
      }
    }
  }
  return null;
};

// ── Tier 5 VERY_HARD Checkers ─────────────────────────────────────────────────

// BUG (Bivalue Universal Grave +1)
// If exactly one unsolved cell has 3 candidates and all others have exactly 2,
// the candidate that appears an odd number of times in all three of its units
// is the forced solution for that cell.
const findBUG = (cands, cells, regions) => {
  const unsolved = [];
  for (let id = 0; id < 81; id++) {
    if (cands[id].size > 0) unsolved.push(id);
  }
  const triples = unsolved.filter(id => cands[id].size === 3);
  if (triples.length !== 1) return null;
  if (unsolved.some(id => cands[id].size !== 2 && cands[id].size !== 3)) return null;

  const tripleId = triples[0];
  for (const v of cands[tripleId]) {
    const rowC = rowPeers(tripleId).filter(id => cands[id].has(v)).length;
    const colC = colPeers(tripleId).filter(id => cands[id].has(v)).length;
    const boxC = boxPeers(tripleId, regions).filter(id => cands[id].has(v)).length;
    if (rowC % 2 === 1 && colC % 2 === 1 && boxC % 2 === 1) {
      return {
        techniqueId: 'BUG',
        cellIds: [tripleId],
        placement: { id: tripleId, value: v },
        eliminations: null,
        description: `BUG+1: cell ${tripleId} must be ${v} to avoid a deadly pattern.`
      };
    }
  }
  return null;
};

// CHAINS_AIC (Alternating Inference Chains)
// Implements X-Chains (single digit) and XY-Chains (multi-digit through bivalue cells).
// For X-Chain: chain alternates strong links (forced) and weak links (exclusion).
//   Nodes: "off" → strong → "on" → weak → "off" → ... → "on"
//   At least one of {startNode, endNode} must be v → eliminate v from cells seeing both.
// For XY-Chain: chain traverses bivalue cells passing a "chain digit" at each step.
//   Start has {elimDigit, x}; end has {y, elimDigit}; at least one end = elimDigit.
const findChainsAIC = (cands, cells, regions) => {
  const units = getAllUnits(regions);
  const X_MAX = 8;
  const XY_MAX = 6;

  // X-Chain
  for (let v = 1; v <= 9; v++) {
    const strong = new Map();
    for (const unit of units) {
      const withV = unit.filter(id => cands[id].has(v));
      if (withV.length !== 2) continue;
      const [a, b] = withV;
      if (!strong.has(a)) strong.set(a, new Set());
      if (!strong.has(b)) strong.set(b, new Set());
      strong.get(a).add(b);
      strong.get(b).add(a);
    }
    if (strong.size === 0) continue;

    const strongNodes = [...strong.keys()];

    for (const startNode of strongNodes) {
      const visited = new Uint8Array(81);
      visited[startNode] = 1;

      const dfsX = (node, isOn, depth) => {
        if (isOn && depth >= 1) {
          const elims = [];
          for (let id = 0; id < 81; id++) {
            if (visited[id] || !cands[id].has(v)) continue;
            if (seesEachOther(id, startNode, regions) && seesEachOther(id, node, regions)) {
              elims.push({ id, value: v });
            }
          }
          if (elims.length > 0) return { elims, endNode: node };
        }
        if (depth >= X_MAX) return null;

        if (!isOn) {
          // Off → on via strong link
          const nbs = strong.has(node) ? [...strong.get(node)] : [];
          for (const nb of nbs) {
            if (visited[nb]) continue;
            visited[nb] = 1;
            const r = dfsX(nb, true, depth + 1);
            visited[nb] = 0;
            if (r) return r;
          }
        } else {
          // On → off via weak link (only to strong-graph nodes for tractability)
          for (const nb of strongNodes) {
            if (visited[nb] || !cands[nb].has(v)) continue;
            if (!seesEachOther(nb, node, regions)) continue;
            visited[nb] = 1;
            const r = dfsX(nb, false, depth + 1);
            visited[nb] = 0;
            if (r) return r;
          }
        }
        return null;
      };

      const result = dfsX(startNode, false, 0);
      if (result) {
        return {
          techniqueId: 'CHAINS_AIC',
          cellIds: [startNode, result.endNode],
          placement: null,
          eliminations: dedupeElims(result.elims),
          description: `X-Chain on ${v}: eliminate from cells seeing both ends.`
        };
      }
    }
  }

  // XY-Chain
  const bivalueCells = [];
  for (let id = 0; id < 81; id++) {
    if (cands[id].size === 2) bivalueCells.push(id);
  }

  for (const startNode of bivalueCells) {
    for (const elimDigit of cands[startNode]) {
      const initChainDigit = [...cands[startNode]].find(d => d !== elimDigit);
      const visited = new Uint8Array(81);
      visited[startNode] = 1;

      const dfsXY = (node, chainDigit, depth) => {
        for (const nb of bivalueCells) {
          if (visited[nb] || !cands[nb].has(chainDigit)) continue;
          if (!seesEachOther(nb, node, regions)) continue;
          const nextDigit = [...cands[nb]].find(d => d !== chainDigit);
          if (nextDigit === undefined) continue;

          if (depth >= 1 && nextDigit === elimDigit) {
            const elims = [];
            for (let id = 0; id < 81; id++) {
              if (id === startNode || id === nb || !cands[id].has(elimDigit)) continue;
              if (seesEachOther(id, startNode, regions) && seesEachOther(id, nb, regions)) {
                elims.push({ id, value: elimDigit });
              }
            }
            if (elims.length > 0) return { elims, endNode: nb };
          }

          if (depth < XY_MAX - 1) {
            visited[nb] = 1;
            const r = dfsXY(nb, nextDigit, depth + 1);
            visited[nb] = 0;
            if (r) return r;
          }
        }
        return null;
      };

      const result = dfsXY(startNode, initChainDigit, 0);
      if (result) {
        return {
          techniqueId: 'CHAINS_AIC',
          cellIds: [startNode, result.endNode],
          placement: null,
          eliminations: dedupeElims(result.elims),
          description: `XY-Chain: eliminate ${elimDigit} from cells seeing both ends.`
        };
      }
    }
  }

  return null;
};

// ALS-XZ Rule
// An ALS is N cells within a unit with exactly N+1 candidates total.
// If two ALS share a "restricted common" x (every x-cell in A sees every x-cell in B)
// and both contain another candidate z, eliminate z from cells outside A and B
// that see all z-candidates in both A and B.
// A is restricted to bivalue cells (size 1) for tractability.
const findALS = (cands, cells, regions) => {
  const units = getAllUnits(regions);

  // Collect all ALS of size 1–4 within a single unit, deduplicated by cell set
  const alsMap = new Map();
  for (const unit of units) {
    const unsolved = unit.filter(id => cands[id].size > 0);
    for (let n = 1; n <= 4; n++) {
      for (const subset of combinations(unsolved, n)) {
        const key = [...subset].sort((a, b) => a - b).join(',');
        if (alsMap.has(key)) continue;
        const candUnion = new Set();
        for (const id of subset) for (const d of cands[id]) candUnion.add(d);
        if (candUnion.size === n + 1) alsMap.set(key, { cells: subset, cands: candUnion });
      }
    }
  }
  const allALS = [...alsMap.values()];

  // A = bivalue cell (ALS of size 1), B = any ALS
  for (let aId = 0; aId < 81; aId++) {
    if (cands[aId].size !== 2) continue;
    const aCands = [...cands[aId]];

    for (const B of allALS) {
      if (B.cells.includes(aId)) continue;

      for (const x of aCands) {
        if (!B.cands.has(x)) continue;
        // Restricted common: aId must see every x-candidate cell in B
        const xCellsB = B.cells.filter(id => cands[id].has(x));
        if (!xCellsB.every(b => seesEachOther(aId, b, regions))) continue;

        // z = other candidate of A that also appears in B
        const z = aCands.find(d => d !== x);
        if (!B.cands.has(z)) continue;

        const zCellsB = B.cells.filter(id => cands[id].has(z));
        const elims = [];
        for (let id = 0; id < 81; id++) {
          if (id === aId || B.cells.includes(id) || !cands[id].has(z)) continue;
          if (seesEachOther(id, aId, regions) && zCellsB.every(b => seesEachOther(id, b, regions))) {
            elims.push({ id, value: z });
          }
        }
        if (elims.length > 0) {
          return {
            techniqueId: 'ALS',
            cellIds: [aId, ...B.cells],
            placement: null,
            eliminations: dedupeElims(elims),
            description: `ALS-XZ: eliminate ${z}.`
          };
        }
      }
    }
  }
  return null;
};

const checkers = {
  'NAKED_SINGLE': findNakedSingle,
  'HIDDEN_SINGLE': findHiddenSingle,
  'POINTING_PAIR': (cands, cells, regions) => findPointingPairOrTriple(cands, cells, regions, 2, 'POINTING_PAIR'),
  'POINTING_TRIPLE': (cands, cells, regions) => findPointingPairOrTriple(cands, cells, regions, 3, 'POINTING_TRIPLE'),
  'BOX_LINE_REDUCTION': findBoxLineReduction,
  'NAKED_PAIR': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 2, 'NAKED_PAIR'),
  'HIDDEN_PAIR': findHiddenPair,
  'NAKED_TRIPLE': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 3, 'NAKED_TRIPLE'),
  'HIDDEN_TRIPLE': findHiddenTriple,
  'NAKED_QUAD': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 4, 'NAKED_QUAD'),
  'HIDDEN_QUAD': findHiddenQuad,
  'X_WING': findXWing,
  'XY_WING': findXYWing,
  'XYZ_WING': findXYZWing,
  'SKYSCRAPER': findSkyscraper,
  'TWO_STRING_KITE': findTwoStringKite,
  'SWORDFISH': findSwordfish,
  'JELLYFISH': findJellyfish,
  'W_WING': findWWing,
  'EMPTY_RECTANGLE': findEmptyRectangle,
  'FINNED_X_WING': findFinnedXWing,
  'UNIQUE_RECTANGLE': findUniqueRectangle,
  'COLORING': findColoring,
  'CHAINS_AIC': findChainsAIC,
  'BUG': findBUG,
  'ALS': findALS
};

export const findNextStep = (cells, regions) => {
  let cands = getCandidates(cells, regions);
  const nakedSingles = [];
  for (let i = 0; i < 81; i++) {
    if (cands[i].size === 1) nakedSingles.push({ id: i, cands: Array.from(cands[i]) });
  }
  if (typeof self !== 'undefined') {
    self.postMessage({
      type: 'DEBUG',
      nakedSingles,
      totalEmpty: Array.from({length: 81}, (_, i) => i).filter(i => cands[i].size > 0).length
    });
  }
  for (const tech of TECHNIQUES) {
    const checker = checkers[tech.id];
    if (checker) {
      const result = checker(cands, cells, regions);
      if (result) return result;
    }
  }
  return null;
};

const solveFully = (cells, regions) => {
  let cands = getCandidates(cells, regions);
  let highestTier = 'VERY_EASY';
  const usedTechniques = [];
  
  let stuck = false;
  while (!stuck) {
    stuck = true;
    for (const tech of TECHNIQUES) {
      const checker = checkers[tech.id];
      if (checker) {
        const result = checker(cands, cells, regions);
        if (result) {
          usedTechniques.push(result.techniqueId);
          const tierIdx = (t) => ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'].indexOf(t);
          if (tierIdx(tech.tier) > tierIdx(highestTier)) {
            highestTier = tech.tier;
          }
          if (result.placement) {
            const { id, value } = result.placement;
            cands[id].clear();
            // In a real sim, we should also clear peers, but this is enough for grading stubs
          } else if (result.eliminations) {
            result.eliminations.forEach(({ id, value }) => cands[id].delete(value));
          }
          stuck = false;
          break;
        }
      }
    }
  }
  return { highestTier, usedTechniques };
};

if (typeof self !== 'undefined') self.onmessage = (e) => {
  const { type, payload } = e.data;
  if (!type || !payload) return; // ignore malformed/debug messages
  const { cells, regions } = payload;
  
  if (type === 'GRADE') {
    const { highestTier, usedTechniques } = solveFully(cells, regions);
    self.postMessage({ type: 'GRADE_RESULT', payload: { difficulty: highestTier, techniques: usedTechniques } });
  } else if (type === 'HINT_NEXT_CELL') {
    const step = findNextStep(cells, regions);
    self.postMessage({ type: 'HINT_RESULT', payload: step ? { cellId: step.cellIds[0] } : null });
  } else if (type === 'HINT_NEXT_TECHNIQUE') {
    const step = findNextStep(cells, regions);
    self.postMessage({ type: 'HINT_RESULT', payload: step });
  }
};
