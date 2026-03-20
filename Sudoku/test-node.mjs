/**
 * Node.js test runner for:
 *   Test 1 — Hints test (findNextStep solving a HARD puzzle)
 *   Test 2 — Generation smoke test (new human-guided algorithm per difficulty)
 *
 * Avoids all browser-only imports (Worker, IndexedDB) by importing only the
 * pure logic files: humanSolver.js, generator.js, solver.js, prng.js, techniques.js
 *
 * Run: node test-node.mjs
 */

import { generatePuzzle as legacyGeneratePuzzle, generateSolutionGrid } from './src/logic/generator.js';
import { findNextStep, solveFully } from './src/logic/humanSolver.js';
import { hasUniqueSolution } from './src/logic/solver.js';
import { createPRNG } from './src/logic/prng.js';
import { DIFFICULTY_ORDER } from './src/config/techniques.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const pass  = (msg) => console.log(`  PASS: ${msg}`);
const fail  = (msg) => { console.error(`  FAIL: ${msg}`); process.exitCode = 1; };
const check = (ok, msg) => ok ? pass(msg) : fail(msg);
const hr    = () => console.log('─'.repeat(60));

/** Build a cell-to-region lookup array (index → regionId). */
const buildCellToRegion = (regions) => {
  const m = new Array(81).fill(0);
  regions.forEach((cells, rId) => cells.forEach(idx => { m[idx] = rId; }));
  return m;
};

/** True if two cell ids share a row, column, or region. */
const seePair = (a, b, cellToRegion) => {
  if (a === b) return false;
  if (Math.floor(a / 9) === Math.floor(b / 9)) return true;
  if (a % 9 === b % 9) return true;
  return cellToRegion[a] === cellToRegion[b];
};

/**
 * Recompute c[] for every unsolved non-fixed cell from scratch, respecting
 * the cells' current v values and each cell's removedCandidates list.
 * Mutates cells in place.
 */
const refreshCandidates = (cells, cellToRegion) => {
  cells.forEach(cell => {
    if (cell.v != null || cell.fixed) { cell.c = []; return; }
    const used = new Set();
    cells.forEach(other => {
      if (other.v != null && seePair(cell.id, other.id, cellToRegion)) used.add(other.v);
    });
    const removed = cell.removedCandidates || [];
    cell.c = [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n) && !removed.includes(n));
  });
};

/**
 * Apply a placement: set v, clear c, propagate removal to peers.
 * Mutates cells in place.
 */
const applyPlacement = (cells, cellToRegion, id, value) => {
  cells[id].v = value;
  cells[id].c = [];
  cells.forEach(other => {
    if (other.v != null || other.id === id) return;
    if (seePair(id, other.id, cellToRegion)) {
      other.c = other.c.filter(v => v !== value);
    }
  });
};

/**
 * Apply eliminations: add each (id, value) pair to removedCandidates and
 * remove it from c.  Returns the count actually applied.
 */
const applyEliminations = (cells, eliminations) => {
  let applied = 0;
  eliminations.forEach(({ id, value }) => {
    const cell = cells[id];
    if (!cell.c.includes(value)) return;
    cell.c = cell.c.filter(v => v !== value);
    cell.removedCandidates = [...(cell.removedCandidates || []), value];
    applied++;
  });
  return applied;
};

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Hints (findNextStep drives a HARD puzzle to completion)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ TEST 1 — Hints System ═══');

let testPuzzle = null;
let foundAtSeed = null;

// Find a HARD puzzle that genuinely requires elimination techniques
for (let seed = 1; seed <= 200; seed++) {
  const puzzle = legacyGeneratePuzzle({ difficulty: 'HARD', seed: String(seed), mode: 'STANDARD' });
  const regions = puzzle.regions;
  const ctr = buildCellToRegion(regions);
  const working = puzzle.cells.map(c => ({
    ...c,
    c: [],
    removedCandidates: [],
    manualCandidates: [],
    autoCandidates: []
  }));
  refreshCandidates(working, ctr);

  // Check if it stalls without going beyond NAKED/HIDDEN SINGLE
  let needsElim = false;
  for (let step = 0; step < 300; step++) {
    const remaining = working.filter(c => !c.fixed && c.v == null);
    if (remaining.length === 0) break;
    const result = findNextStep(working, regions);
    if (!result) { needsElim = true; break; }
    if (!['NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(result.techniqueId)) { needsElim = true; break; }
    if (result.placement) {
      applyPlacement(working, ctr, result.placement.id, result.placement.value);
    }
  }
  if (needsElim) { testPuzzle = puzzle; foundAtSeed = seed; break; }
}

check(testPuzzle !== null, `Found a HARD puzzle requiring elimination techniques (searched seeds 1–200)`);
if (!testPuzzle) process.exit(1);
console.log(`  Using seed ${foundAtSeed}`);

// Set up a fresh working copy with candidates
const regions1 = testPuzzle.regions;
const ctr1 = buildCellToRegion(regions1);
const cells1 = testPuzzle.cells.map(c => ({
  ...c,
  c: [],
  removedCandidates: [],
  manualCandidates: [],
  autoCandidates: []
}));
refreshCandidates(cells1, ctr1);

// Drive puzzle to completion
const MAX_HINTS   = 300;
const STALL_LIMIT = 20;

let hints        = 0;
let stalledFor   = 0;
let lastFilled   = 0;
let lastTech     = null;
let nullReturned = false;
let solved       = false;
const techsUsed  = new Set();

while (hints < MAX_HINTS) {
  const nonFixed = cells1.filter(c => !c.fixed);
  if (nonFixed.every(c => c.v != null && c.v === c.solution)) { solved = true; break; }

  const result = findNextStep(cells1, regions1);
  if (!result) {
    nullReturned = true;
    const empty = cells1.filter(c => !c.fixed && c.v == null);
    const zeroCands = empty.filter(c => !c.c || c.c.length === 0);
    console.error(`  findNextStep returned null after ${hints} hints.`);
    console.error(`  Unsolved: ${empty.length}, zero-candidate cells: ${zeroCands.length}`);
    if (zeroCands.length > 0) {
      console.error(`  Sample zero-cand: ${JSON.stringify(zeroCands.slice(0,3).map(c => ({ id: c.id, v: c.v, fixed: c.fixed })))}`);
    }
    break;
  }

  techsUsed.add(result.techniqueId);
  lastTech = result.techniqueId;
  hints++;

  if (result.placement) {
    applyPlacement(cells1, ctr1, result.placement.id, result.placement.value);
    // After each placement, refresh all candidates (mirrors autoCandidates behaviour)
    refreshCandidates(cells1, ctr1);
  } else if (result.eliminations) {
    const done = applyEliminations(cells1, result.eliminations);
    if (done === 0) {
      // All eliminations already applied — stall guard
      stalledFor++;
    }
  }

  const filledNow = cells1.filter(c => !c.fixed && c.v != null).length;
  if (filledNow > lastFilled) { lastFilled = filledNow; stalledFor = 0; }
  else stalledFor++;

  if (stalledFor >= STALL_LIMIT) {
    const empty = cells1.filter(c => !c.fixed && c.v == null);
    fail(`Hint system stalled for ${STALL_LIMIT} consecutive non-progress hints. ` +
         `${empty.length} cells unsolved. Last technique: ${lastTech}`);
    break;
  }
}

check(!nullReturned, 'findNextStep never returned null mid-solve');
check(solved,        `Puzzle solved to completion (${hints} hints, last technique: ${lastTech})`);
if (solved) {
  console.log(`  Techniques used: ${[...techsUsed].join(', ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Generation smoke test (inline new human-guided algorithm)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n═══ TEST 2 — Generation Smoke Test ═══');

const buildStandardRegions = () => {
  const regions = Array.from({ length: 9 }, () => []);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      regions[Math.floor(r / 3) * 3 + Math.floor(c / 3)].push(r * 9 + c);
    }
  }
  return regions;
};

const buildCells = (puzzle, solution, regions) => {
  const ctr = buildCellToRegion(regions);
  return Array.from({ length: 81 }, (_, i) => ({
    id: i,
    v: puzzle[i] !== 0 ? puzzle[i] : null,
    c: [],
    fixed: puzzle[i] !== 0,
    solution: solution[i],
    region: ctr[i],
    removedCandidates: [],
    manualCandidates: [],
    autoCandidates: []
  }));
};

// Minimum difficulty tier the puzzle must reach (mirrors generatorWorker.js)
const TIER_MIN_REQUIRED = {
  VERY_EASY: 'VERY_EASY',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  VERY_HARD: 'HARD'  // SWORDFISH/AIC too rare; HARD tier is the reliable minimum
};

/**
 * Inline version of generatorWorker.generatePuzzle — no self.postMessage.
 * Tries up to maxAttempts seeds, enforces TIER_MIN_TECHNIQUE.
 */
const inlineGenerate = (seed, difficulty, maxAttempts = 50) => {
  const regions = buildStandardRegions();
  const maxTier = difficulty;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}_${attempt}`;
    const solution = generateSolutionGrid(attemptSeed);
    if (!solution) continue;

    const prng = createPRNG(`${attemptSeed}_remove`);
    const puzzle = [...solution];
    const order = prng.shuffle(Array.from({ length: 81 }, (_, i) => i));

    let failStreak = 0;
    for (let i = 0; i < order.length; i++) {
      if (failStreak >= 20) break;
      const pos = order[i];
      const saved = puzzle[pos];
      puzzle[pos] = 0;

      let keep = false;
      if (hasUniqueSolution(puzzle)) {
        const cells = buildCells(puzzle, solution, regions);
        const { solved } = solveFully(cells, regions, maxTier);
        if (solved) { keep = true; failStreak = 0; }
      }
      if (!keep) { puzzle[pos] = saved; failStreak++; }
    }

    const cells = buildCells(puzzle, solution, regions);
    const { solved, highestTier, usedTechniques } = solveFully(cells, regions, maxTier);
    if (!solved) continue;
    const uniqueTechs = [...new Set(usedTechniques)];
    const minRequired = TIER_MIN_REQUIRED[difficulty];
    if (DIFFICULTY_ORDER.indexOf(highestTier) < DIFFICULTY_ORDER.indexOf(minRequired) && attempt < maxAttempts - 1) continue;

    return {
      puzzle,
      solution,
      regions,
      clues: puzzle.filter(v => v !== 0).length,
      difficulty: highestTier,
      techniques: uniqueTechs,
      attempts: attempt + 1
    };
  }
  throw new Error(`Could not generate a ${difficulty} puzzle after ${maxAttempts} attempts`);
};

const DIFFICULTIES = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

for (const diff of DIFFICULTIES) {
  console.log(`\n  Generating ${diff}…`);
  const seed = `smoke_${diff}_1`;
  const t0 = performance.now();
  let result;
  try {
    result = inlineGenerate(seed, diff);
  } catch (e) {
    fail(`${diff}: generation threw — ${e.message}`);
    continue;
  }
  const elapsed = ((performance.now() - t0) / 1000).toFixed(2);

  // Independently verify with solveFully
  const verifyCells = buildCells(result.puzzle, result.solution, result.regions);
  const verify = solveFully(verifyCells, result.regions, diff);

  const minRequired = TIER_MIN_REQUIRED[diff];
  const meetsMin = DIFFICULTY_ORDER.indexOf(result.difficulty) >= DIFFICULTY_ORDER.indexOf(minRequired);

  console.log(`  Time        : ${elapsed}s (${result.attempts} seed attempt${result.attempts > 1 ? 's' : ''})`);
  console.log(`  Clues       : ${result.clues}`);
  console.log(`  Reported    : ${result.difficulty}`);
  console.log(`  Techniques  : ${result.techniques.join(', ') || '(none — naked singles only)'}`);

  check(verify.solved, `${diff}: independently verified as human-solvable within tier`);
  check(result.clues >= 17 && result.clues <= 81, `${diff}: clue count plausible (${result.clues})`);
  check(
    DIFFICULTY_ORDER.indexOf(result.difficulty) <= DIFFICULTY_ORDER.indexOf(diff),
    `${diff}: reported difficulty (${result.difficulty}) ≤ target tier`
  );
  check(meetsMin, `${diff}: reaches minimum tier (${minRequired}) — got ${result.difficulty}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Memory check note
// ─────────────────────────────────────────────────────────────────────────────

hr();
console.log('\n  TEST 3 — Memory check (manual browser step):');
console.log('  1. Open the app and open DevTools → Sources → Workers');
console.log('  2. Click "Quick Play" — a loading overlay should appear briefly');
console.log('  3. After the puzzle loads, check Workers panel');
console.log('  4. Expected: only the humanSolver.js worker persists');
console.log('     The generatorWorker should have terminated (PuzzlePool._client');
console.log('     is a singleton; its worker is shared across all generations)');
console.log('  5. On beforeunload, puzzlePool.terminate() is called, cleaning it up');

hr();
console.log('');
