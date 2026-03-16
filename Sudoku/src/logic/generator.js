import { createPRNG } from './prng.js';
import { solve, hasUniqueSolution } from './solver.js';
import { DIFFICULTY_DEFAULTS } from '../config/difficulty.js';

export const getDailyConfig = (dateString) => {
  const prng = createPRNG(dateString);
  const diffIdx = prng.nextInt(0, 4);
  const diffs = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];
  return { seed: dateString, difficulty: diffs[diffIdx] };
};

export const generateChaosRegions = (seed) => {
  const prng = createPRNG(seed);
  while (true) {
    const regions = Array.from({length: 9}, () => []);
    const assigned = new Array(81).fill(false);
    
    const allCells = prng.shuffle(Array.from({length: 81}, (_, i) => i));
    const roots = allCells.slice(0, 9);
    for (let i = 0; i < 9; i++) {
      regions[i].push(roots[i]);
      assigned[roots[i]] = true;
    }

    let stuck = false;
    let added = true;

    while (added) {
      added = false;
      const regionIndices = prng.shuffle([0,1,2,3,4,5,6,7,8]);
      for (const i of regionIndices) {
        if (regions[i].length < 9) {
          const neighbors = [];
          for (const cell of regions[i]) {
            const r = Math.floor(cell / 9);
            const c = cell % 9;
            if (r > 0 && !assigned[cell - 9]) neighbors.push(cell - 9);
            if (r < 8 && !assigned[cell + 9]) neighbors.push(cell + 9);
            if (c > 0 && !assigned[cell - 1]) neighbors.push(cell - 1);
            if (c < 8 && !assigned[cell + 1]) neighbors.push(cell + 1);
          }
          if (neighbors.length > 0) {
            const chosen = neighbors[prng.nextInt(0, neighbors.length - 1)];
            regions[i].push(chosen);
            assigned[chosen] = true;
            added = true;
          }
        }
      }
    }
    
    if (regions.every(r => r.length === 9)) {
      return regions;
    }
  }
};

export const generateReconPieces = (solution, seed) => {
  const prng = createPRNG(seed);
  const pieces = [];
  const assigned = new Array(81).fill(false);
  const cells = prng.shuffle(Array.from({length: 81}, (_, i) => i));
  
  let currentPiece = [];
  
  for (const startCell of cells) {
    if (assigned[startCell]) continue;
    
    currentPiece = [startCell];
    assigned[startCell] = true;
    const targetSize = prng.nextInt(4, 6);
    
    while (currentPiece.length < targetSize) {
      const neighbors = [];
      for (const cell of currentPiece) {
        const r = Math.floor(cell / 9);
        const c = cell % 9;
        if (r > 0 && !assigned[cell - 9]) neighbors.push(cell - 9);
        if (r < 8 && !assigned[cell + 9]) neighbors.push(cell + 9);
        if (c > 0 && !assigned[cell - 1]) neighbors.push(cell - 1);
        if (c < 8 && !assigned[cell + 1]) neighbors.push(cell + 1);
      }
      if (neighbors.length === 0) break;
      const chosen = neighbors[prng.nextInt(0, neighbors.length - 1)];
      currentPiece.push(chosen);
      assigned[chosen] = true;
    }
    pieces.push(currentPiece);
  }

  for (let i = pieces.length - 1; i >= 0; i--) {
    if (pieces[i].length < 2) {
      const pieceToMerge = pieces[i];
      pieces.splice(i, 1);
      let merged = false;
      for (const cell of pieceToMerge) {
        if (merged) break;
        const r = Math.floor(cell / 9);
        const c = cell % 9;
        const adj = [
          r > 0 ? cell - 9 : -1,
          r < 8 ? cell + 9 : -1,
          c > 0 ? cell - 1 : -1,
          c < 8 ? cell + 1 : -1
        ];
        for (const p of pieces) {
          if (p.some(pc => adj.includes(pc))) {
            p.push(...pieceToMerge);
            merged = true;
            break;
          }
        }
      }
      if (!merged && pieces.length > 0) {
        pieces[0].push(...pieceToMerge);
      }
    }
  }
  return pieces;
};

export const generatePuzzle = ({ difficulty, seed, mode, clues }) => {
  const prng = createPRNG(seed);
  let regions = null;
  if (mode === 'CHAOS') {
    regions = generateChaosRegions(seed);
  } else {
    regions = Array.from({length: 9}, () => []);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const idx = Math.floor(r/3)*3 + Math.floor(c/3);
        regions[idx].push(r*9+c);
      }
    }
  }

  const emptyGrid = new Array(81).fill(0);
  const firstRow = prng.shuffle([1,2,3,4,5,6,7,8,9]);
  for(let i=0; i<9; i++) emptyGrid[i] = firstRow[i];
  
  const solution = solve(emptyGrid, mode === 'CHAOS' ? regions : null);
  if (!solution) throw new Error("Could not generate a base puzzle solution");

  const targetClues = clues !== undefined ? clues : DIFFICULTY_DEFAULTS[difficulty];
  const puzzle = [...solution];
  
  const positions = prng.shuffle(Array.from({length: 81}, (_, i) => i));
  let cluesLeft = 81;

  for (const pos of positions) {
    if (cluesLeft <= targetClues) break;
    const temp = puzzle[pos];
    puzzle[pos] = 0;
    
    if (!hasUniqueSolution(puzzle, mode === 'CHAOS' ? regions : null)) {
      puzzle[pos] = temp;
    } else {
      cluesLeft--;
    }
  }

  const cells = [];
  for (let i = 0; i < 81; i++) {
    let regionId = 0;
    for (let rId = 0; rId < 9; rId++) {
      if (regions[rId].includes(i)) {
        regionId = rId;
        break;
      }
    }
    cells.push({
      id: i,
      v: puzzle[i] !== 0 ? puzzle[i] : null,
      c: [],
      fixed: puzzle[i] !== 0,
      solution: solution[i],
      region: regionId
    });
  }

  return { cells, solution, regions };
};
