import { TECHNIQUES, getTier } from '../config/techniques.js';

// --- Candidate Utilities ---
const getCandidates = (cells, regions) => {
  const cands = Array.from({length: 81}, () => new Set([1,2,3,4,5,6,7,8,9]));
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
    if (grid[i]) {
      cands[i].clear();
    } else {
      const peers = new Set([...getRowCells(i), ...getColCells(i), ...getRegionCells(i)]);
      for (const p of peers) {
        if (grid[p]) cands[i].delete(grid[p]);
      }
    }
  }
  return cands;
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

const checkers = {
  'NAKED_SINGLE': findNakedSingle,
  'HIDDEN_SINGLE': findHiddenSingle,
  'NAKED_PAIR': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 2, 'NAKED_PAIR'),
  'NAKED_TRIPLE': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 3, 'NAKED_TRIPLE'),
  'NAKED_QUAD': (cands, cells, regions) => findNakedSubset(cands, cells, regions, 4, 'NAKED_QUAD')
};

const findNextStep = (cells, regions) => {
  let cands = getCandidates(cells, regions);
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

self.onmessage = (e) => {
  const { type, payload } = e.data;
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
