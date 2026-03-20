const _cache = {};

async function loadPuzzleFile(type) {
  if (_cache[type]) return _cache[type];
  const path = type === 'classic'
    ? './puzzles/classic_9x9_puzzles.json'
    : './puzzles/jigsaw_9x9_puzzles.json';
  const res = await fetch(path);
  _cache[type] = await res.json();
  return _cache[type];
}

export async function getRandomPuzzle(type, difficulty) {
  const all = await loadPuzzleFile(type);
  const diffLower = difficulty.toLowerCase();
  const matching = all.filter(p => p.difficulty === diffLower);
  if (matching.length === 0) {
    throw new Error(`No ${type} puzzles for difficulty ${difficulty}`);
  }
  const idx = Math.floor(Math.random() * matching.length);
  return matching[idx];
}

export async function getSeededPuzzle(type, difficulty, seed) {
  const all = await loadPuzzleFile(type);
  const diffLower = difficulty.toLowerCase();
  const matching = all.filter(p => p.difficulty === diffLower);
  if (matching.length === 0) {
    throw new Error(`No ${type} puzzles for difficulty ${difficulty}`);
  }
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return matching[h % matching.length];
}

export function puzzleToGameState(record) {
  const puzzle = record.puzzle;
  const solution = record.solution;

  let regions;
  if (record.jigsaw_layout) {
    regions = Array.from({length: 9}, () => []);
    for (let i = 0; i < 81; i++) {
      const regionIdx = parseInt(record.jigsaw_layout[i]);
      regions[regionIdx].push(i);
    }
  } else {
    regions = buildStandardRegions();
  }

  const cells = [];
  for (let i = 0; i < 81; i++) {
    const isFixed = puzzle[i] !== '.';
    const v = isFixed ? parseInt(puzzle[i]) : null;
    const sol = parseInt(solution[i]);
    cells.push({
      id: i,
      v: isFixed ? v : null,
      c: [],
      fixed: isFixed,
      solution: sol,
      region: getRegionForCell(i, regions),
      placedBy: null,
      manualCandidates: [],
      autoCandidates: [],
      removedCandidates: []
    });
  }

  return {
    cells,
    regions,
    seed: record.id,
    difficulty: record.difficulty.toUpperCase().replace('_EASY', '_EASY'),
    normalizedScore: record.normalized_score,
    techniques: record.techniques_used,
    mode: record.type === 'jigsaw' ? 'CHAOS' : 'STANDARD'
  };
}

function getRegionForCell(cellId, regions) {
  for (let r = 0; r < regions.length; r++) {
    if (regions[r].includes(cellId)) return r;
  }
  return 0;
}

function buildStandardRegions() {
  return Array.from({length: 9}, (_, boxIdx) => {
    const startRow = Math.floor(boxIdx / 3) * 3;
    const startCol = (boxIdx % 3) * 3;
    const cells = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells.push((startRow + r) * 9 + (startCol + c));
      }
    }
    return cells;
  });
}

export async function getDailyPuzzle() {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = 'sudoku_daily_' + today;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  const all = await loadPuzzleFile('classic');
  const medium = all.filter(p => p.difficulty === 'medium');
  const dateNum = parseInt(today.replace(/-/g, ''));
  const idx = dateNum % medium.length;
  const record = medium[idx];
  const gameState = puzzleToGameState(record);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(gameState));
    for (let i = 8; i <= 30; i++) {
      const old = new Date();
      old.setDate(old.getDate() - i);
      const oldKey = 'sudoku_daily_' + old.toISOString().split('T')[0];
      localStorage.removeItem(oldKey);
    }
  } catch {}

  return gameState;
}
