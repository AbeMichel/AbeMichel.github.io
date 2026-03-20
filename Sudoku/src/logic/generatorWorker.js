import { solveFully, getCandidates, checkers, allPeers } from './humanSolver.js';
import { hasUniqueSolution } from './solver.js';
import { generateSolutionGrid } from './generator.js';
import { createPRNG } from './prng.js';
import { TECHNIQUES, TECHNIQUE_MULTIPLIERS } from '../config/techniques.js';
import { SCORE_RANGES, normalizeScore, getDifficultyFromScore, isScoreInRange } from '../config/difficulty.js';

// humanSolver.js sets self.onmessage as a side effect of import.
// We override it below (ES modules: all imports execute before this module body).

// ─── Region / Cell builders ───────────────────────────────────────────────────

const buildStandardRegions = () => {
  const regions = Array.from({ length: 9 }, () => []);
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const idx = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      regions[idx].push(r * 9 + c);
    }
  }
  return regions;
};

const buildCells = (puzzle, solution, regions) => {
  const cells = [];
  for (let i = 0; i < 81; i++) {
    let regionId = 0;
    for (let rId = 0; rId < 9; rId++) {
      if (regions[rId].includes(i)) { regionId = rId; break; }
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
  return cells;
};

// ─── Scoring helpers ──────────────────────────────────────────────────────────

const TOTAL_CANDS_BASELINE = 727;

// Candidate density factor: scales step scores by board openness.
function computeF(cands) {
  let C = 0;
  for (let i = 0; i < 81; i++) C += cands[i].size;
  return (C / TOTAL_CANDS_BASELINE) * 20;
}

// Score one solver step given the current density factor.
// result: checker return value — must have techniqueId; may have chainLength.
function scoreStep(result, F) {
  const base = TECHNIQUE_MULTIPLIERS[result.techniqueId] ?? 1;
  const chainLen = result.chainLength ?? 0;
  return (base + chainLen) * F;
}

// Run a complete fresh solve on a puzzle, accumulating a difficulty score.
// Always solves from scratch — no incremental state carried in. This is
// intentional: solver-derived eliminations cascade and cannot be safely
// inherited across clue removals without full dependency tracking.
//
// Returns:
//   { rawScore, normalizedScore, stuck, complete, pruned, techniques }
// maxTechniqueIdx: when set, only run techniques up to that TECHNIQUES array index.
// Pass FAST_SOLVE_MAX_TECH during search exploration for speed;
// pass FULL_SOLVE_MAX_TECH (null) for final accurate scoring.
function scoredSolve(puzzle, solution, regions, maxNormScore, maxTechniqueIdx = null) {
  // Build fresh cell objects and candidate sets from the puzzle pattern
  const cells = buildCells(puzzle, solution, regions);
  const cands = getCandidates(cells, regions);

  // grid tracks concrete values for both clue cells and solver-placed cells
  const grid = puzzle.slice();

  let rawScore = 0;
  let stuck = false;
  const techniques = [];

  outer: while (true) {
    stuck = true;

    for (const tech of TECHNIQUES) {
      if (maxTechniqueIdx !== null && TECHNIQUES.indexOf(tech) > maxTechniqueIdx) break;
      const checker = checkers[tech.id];
      if (!checker) continue;

      const result = checker(cands, cells, regions);
      if (!result) continue;

      // Score this step using the density-weighted formula
      const F = computeF(cands);
      const step = scoreStep(result, F);
      rawScore += step;
      techniques.push(result.techniqueId);

      // Prune early if we've already exceeded the maximum normalised score
      const ns = normalizeScore(rawScore);
      if (ns > maxNormScore) {
        return {
          rawScore, normalizedScore: ns,
          stuck: false, complete: false,
          pruned: true, techniques
        };
      }

      // Apply the step to cands and grid
      if (result.placement) {
        const { id, value } = result.placement;
        cands[id].clear();
        grid[id] = value;
        for (const p of allPeers(id, regions)) {
          cands[p].delete(value);
        }
      } else if (result.eliminations) {
        for (const { id, value } of result.eliminations) {
          cands[id].delete(value);
        }
      }

      stuck = false;
      continue outer;
    }
    break;
  }

  // complete = every cell has a known value in grid
  const complete = grid.every(v => v !== 0);
  const ns = normalizeScore(rawScore);

  return {
    rawScore, normalizedScore: ns,
    stuck, complete, pruned: false, techniques
  };
}

// ─── Backtracking search infrastructure ──────────────────────────────────────

// Safe postMessage — no-ops when running in Node.js test context.
const postProgress = (percent) => {
  if (typeof self !== 'undefined') {
    self.postMessage({ type: 'PROGRESS', payload: { percent } });
  }
};

const BRANCH_WIDTH = 4;

// Per-difficulty fast-solve technique ceilings used during tree exploration.
// Harder targets need more techniques to determine if a puzzle is solvable.
// Full solve (all techniques) is used only for final accurate scoring.
const FAST_SOLVE_MAX_TECHS = {
  VERY_EASY: TECHNIQUES.findIndex(t => t.id === 'NAKED_PAIR'),
  EASY:      TECHNIQUES.findIndex(t => t.id === 'NAKED_PAIR'),
  MEDIUM:    TECHNIQUES.findIndex(t => t.id === 'NAKED_TRIPLE'),
  HARD:      TECHNIQUES.findIndex(t => t.id === 'SWORDFISH'),
  VERY_HARD: TECHNIQUES.findIndex(t => t.id === 'COLORING'),
};
const FULL_SOLVE_MAX_TECH = null; // all 26 techniques

// Per-difficulty node budgets. Harder puzzles require a deeper search tree.
const NODE_BUDGETS = {
  VERY_EASY:  1000,
  EASY:       2000,
  MEDIUM:     5000,
  HARD:      15000,
  VERY_HARD: 30000,
};

// Rank clue positions by estimated difficulty contribution.
// Heuristic: fewer filled peers → cell is more isolated → removal more likely
// to force harder techniques. Returns up to BRANCH_WIDTH cell indices.
function greedyRankRemovals(puzzle, regions) {
  const clueIds = [];
  for (let i = 0; i < 81; i++) {
    if (puzzle[i] === 0) continue;
    const peers = allPeers(i, regions);
    const filledPeers = peers.filter(p => puzzle[p] !== 0).length;
    // Tie-break by center distance: central cells are more constrained
    // and their removal tends to add more difficulty to the puzzle.
    const centerDist = Math.abs((i % 9) - 4) + Math.abs(Math.floor(i / 9) - 4);
    clueIds.push({ id: i, h: filledPeers * 10 + centerDist });
  }
  // Ascending sort: fewer filled peers first (more isolated = prefer removing)
  clueIds.sort((a, b) => a.h - b.h);
  return clueIds.slice(0, BRANCH_WIDTH).map(x => x.id);
}

// Recursive greedy backtracking search.
// puzzle    — number[81], only active clues are non-zero
// solution  — number[81], the full solution (immutable)
// regions   — standard 9-box regions array
// targetRange — [minNorm, maxNorm] from SCORE_RANGES[difficulty]
// bestResult  — shared mutable { found, puzzle, normalizedScore, techniques }
// nodesVisited — shared mutable { count }
// difficulty is passed so we can look up the correct node budget.
function backtrackSearch(puzzle, solution, regions, targetRange, difficulty, bestResult, nodesVisited) {
  const nodeBudget = NODE_BUDGETS[difficulty] ?? 5000;
  nodesVisited.count++;

  if (nodesVisited.count % 50 === 0) {
    postProgress(Math.min(90, (nodesVisited.count / nodeBudget) * 90));
  }

  if (nodesVisited.count > nodeBudget) return;

  const candidates = greedyRankRemovals(puzzle, regions);

  for (const pos of candidates) {
    const newPuzzle = puzzle.slice();
    newPuzzle[pos] = 0;

    // Reject if removing this clue makes the puzzle non-unique
    if (!hasUniqueSolution(newPuzzle, regions)) continue;

    // Fast solve during search — only cheap techniques up to the difficulty ceiling.
    // This is an approximation: the final result uses a full solve for accuracy.
    const maxTech = FAST_SOLVE_MAX_TECHS[difficulty];
    const result = scoredSolve(
      newPuzzle, solution, regions,
      targetRange[1],
      maxTech
    );

    if (result.pruned) continue; // exceeded max norm score mid-solve

    const ns = result.normalizedScore;

    // Prune branch if already over the ceiling
    if (ns > targetRange[1]) continue;

    // Save if in target range and puzzle is fully solvable by fast techniques.
    // The final full solve in generatePuzzleScored will verify the accurate score.
    if (ns >= targetRange[0] && result.complete) {
      if (!bestResult.found || ns > bestResult.normalizedScore) {
        bestResult.found = true;
        bestResult.puzzle = newPuzzle.slice();
        bestResult.normalizedScore = ns;
        bestResult.techniques = result.techniques;
      }
    }

    // Recurse if score is still below the minimum (need to remove more clues).
    // Guard on result.complete: if the solver couldn't finish the puzzle (stuck
    // without solving it), removing even more clues won't help.
    if (ns < targetRange[0] && result.complete) {
      backtrackSearch(newPuzzle, solution, regions, targetRange, difficulty, bestResult, nodesVisited);
    }

    if (nodesVisited.count > nodeBudget) return;

    // Greedy: return as soon as any in-range result is found
    if (bestResult.found) return;
  }
}

// Top-level scored generation. Tries up to 50 seeds before giving up.
// Kept async so the onmessage handler can await it uniformly.
async function generatePuzzleScored(seed, difficulty) {
  const targetRange = SCORE_RANGES[difficulty];
  if (!targetRange) throw new Error(`Unknown difficulty: ${difficulty}`);

  const regions = buildStandardRegions();

  for (let attempt = 0; attempt < 50; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}_${attempt}`;
    const solution = generateSolutionGrid(attemptSeed);
    if (!solution) continue;

    const puzzle = solution.slice(); // start with all 81 clues
    const bestResult = { found: false, puzzle: null, normalizedScore: 0, techniques: [] };
    const nodesVisited = { count: 0 };

    backtrackSearch(puzzle, solution, regions, targetRange, difficulty, bestResult, nodesVisited);

    if (bestResult.found) {
      // Run a full solve (all 26 techniques) for accurate final scoring.
      // The search used only cheap techniques — the true score may differ.
      const finalResult = scoredSolve(
        bestResult.puzzle, solution, regions,
        Infinity,
        FULL_SOLVE_MAX_TECH
      );
      const accurateScore = finalResult.normalizedScore;
      const accurateDifficulty = getDifficultyFromScore(accurateScore);

      // Only return if the full solve confirms the puzzle is in the target range.
      if (isScoreInRange(accurateScore, difficulty)) {
        postProgress(100);
        const cells = buildCells(bestResult.puzzle, solution, regions);
        return {
          cells,
          regions,
          seed: attemptSeed,
          difficulty: accurateDifficulty,
          normalizedScore: accurateScore,
          techniques: [...new Set(finalResult.techniques)]
        };
      }

      // Full-solve score fell outside target range — reset and try next seed.
      bestResult.found = false;
    }
  }

  throw new Error(`Could not generate ${difficulty} puzzle after 50 attempts`);
}

// ─── Construction-by-solving generator ───────────────────────────────────────

const CONSTRUCTION_TIER_ORDER = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

// Returns all technique ids whose tier is at or below the target difficulty.
function getAllowedTechniqueIds(difficulty) {
  const targetIdx = CONSTRUCTION_TIER_ORDER.indexOf(difficulty);
  return TECHNIQUES
    .filter(t => CONSTRUCTION_TIER_ORDER.indexOf(t.tier) <= targetIdx)
    .map(t => t.id);
}

// Returns the tier string for a technique id.
const techTier = (techniqueId) =>
  TECHNIQUES.find(t => t.id === techniqueId)?.tier ?? 'VERY_EASY';

// Runs the human solver from scratch using only the specified technique ids.
// Returns { complete, solvedCells, techniques, finalGrid }
function solveFromScratch(puzzle, solution, regions, allowedTechniqueIds) {
  const cells = buildCells(puzzle, solution, regions);
  const cands = getCandidates(cells, regions);
  const grid = puzzle.slice();
  const solvedCells = [];
  const techniques = [];

  outer: while (true) {
    for (const tech of TECHNIQUES) {
      if (!allowedTechniqueIds.includes(tech.id)) continue;
      const checker = checkers[tech.id];
      if (!checker) continue;
      const result = checker(cands, cells, regions);
      if (!result) continue;

      techniques.push(result.techniqueId);

      if (result.placement) {
        const { id, value } = result.placement;
        cands[id].clear();
        grid[id] = value;
        solvedCells.push(id);
        for (const p of allPeers(id, regions)) cands[p].delete(value);
      } else if (result.eliminations) {
        for (const { id, value } of result.eliminations) cands[id].delete(value);
      }

      continue outer;
    }
    break;
  }

  return { complete: grid.every(v => v !== 0), solvedCells, techniques, finalGrid: grid };
}

// Runs one solver step using only the allowed techniques.
// Returns the first firing technique result, or null if stuck.
function findNextStepAllowed(puzzle, solution, regions, allowedTechniqueIds) {
  const cells = buildCells(puzzle, solution, regions);
  const cands = getCandidates(cells, regions);
  for (const tech of TECHNIQUES) {
    if (!allowedTechniqueIds.includes(tech.id)) continue;
    const checker = checkers[tech.id];
    if (!checker) continue;
    const result = checker(cands, cells, regions);
    if (result) return result;
  }
  return null;
}

// Constructs a puzzle by seeding clues that unblock specific techniques, then
// minimizes by removing redundant clues. This guarantees the puzzle is solvable
// using only the allowed techniques for the target difficulty.
async function generateByConstruction(seed, difficulty) {
  const allowedTechniqueIds = getAllowedTechniqueIds(difficulty);
  const regions = buildStandardRegions();

  for (let attempt = 0; attempt < 50; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}_${attempt}`;
    const solution = generateSolutionGrid(attemptSeed);
    if (!solution) continue;

    const prng = createPRNG(attemptSeed);
    const puzzle = new Array(81).fill(0);
    let constructionFailed = false;

    // Phase 2 — Construction loop: add clues until solver can complete the puzzle
    while (true) {
      const solveResult = solveFromScratch(puzzle, solution, regions, allowedTechniqueIds);

      const solvedCount = solveResult.finalGrid.filter(v => v !== 0).length;
      postProgress(Math.round((solvedCount / 81) * 70));

      if (solveResult.complete) break;

      // Cells that are neither clues nor solver-deduced
      const unknownCells = [];
      for (let i = 0; i < 81; i++) {
        if (puzzle[i] === 0 && solveResult.finalGrid[i] === 0) unknownCells.push(i);
      }

      // Find clues that, when added, let a technique fire on the next step
      const unblocking = [];
      for (const cellId of unknownCells) {
        const testPuzzle = puzzle.slice();
        testPuzzle[cellId] = solution[cellId];
        const result = findNextStepAllowed(testPuzzle, solution, regions, allowedTechniqueIds);
        if (result) unblocking.push({ cellId, techniqueId: result.techniqueId });
      }

      if (unblocking.length === 0) { constructionFailed = true; break; }

      // Pick a clue that unblocks the highest-tier technique found
      const maxTierIdx = Math.max(
        ...unblocking.map(u => CONSTRUCTION_TIER_ORDER.indexOf(techTier(u.techniqueId)))
      );
      const topCandidates = unblocking.filter(
        u => CONSTRUCTION_TIER_ORDER.indexOf(techTier(u.techniqueId)) === maxTierIdx
      );
      const chosen = topCandidates[prng.nextInt(0, topCandidates.length - 1)];
      puzzle[chosen.cellId] = solution[chosen.cellId];
    }

    if (constructionFailed) continue;

    // Phase 3 — Minimization: remove clues that are redundant given allowed techniques
    const cluePositions = [];
    for (let i = 0; i < 81; i++) { if (puzzle[i] !== 0) cluePositions.push(i); }
    const shuffled = prng.shuffle(cluePositions);
    const removedClues = [];

    for (let idx = 0; idx < shuffled.length; idx++) {
      const pos = shuffled[idx];
      const saved = puzzle[pos];
      puzzle[pos] = 0;

      const result = solveFromScratch(puzzle, solution, regions, allowedTechniqueIds);
      if (result.complete) {
        removedClues.push({ pos, value: saved });
      } else {
        puzzle[pos] = saved;
      }

      postProgress(70 + Math.round(((idx + 1) / shuffled.length) * 30));
    }

    // Phase 4 — Uniqueness verification; restore removed clues one by one if needed
    let unique = hasUniqueSolution(puzzle, regions);
    while (!unique && removedClues.length > 0) {
      const last = removedClues.pop();
      puzzle[last.pos] = last.value;
      unique = hasUniqueSolution(puzzle, regions);
    }
    if (!unique) continue;

    // Phase 5 — Score and return
    postProgress(100);
    const finalResult = scoredSolve(puzzle, solution, regions, Infinity, null);
    const cells = buildCells(puzzle, solution, regions);
    return {
      cells,
      regions,
      seed: attemptSeed,
      difficulty: getDifficultyFromScore(finalResult.normalizedScore),
      normalizedScore: finalResult.normalizedScore,
      techniques: [...new Set(finalResult.techniques)]
    };
  }

  throw new Error(`Could not generate ${difficulty} puzzle after 50 attempts`);
}

// ─── Legacy generation (kept for CHAOS / RECONSTRUCTION / multiplayer) ────────

const humanSolveSync = (puzzle, solution, regions, maxTier) => {
  const cells = buildCells(puzzle, solution, regions);
  return solveFully(cells, regions, maxTier);
};

const DIFFICULTY_ORDER = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];
const tierIdx = (t) => DIFFICULTY_ORDER.indexOf(t);

const TIER_MIN_REQUIRED = {
  VERY_EASY: 'VERY_EASY',
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
  VERY_HARD: 'HARD'
};

const generatePuzzle = (seed, difficulty) => {
  const maxTier = difficulty || 'VERY_HARD';
  const regions = buildStandardRegions();

  for (let attempt = 0; attempt < 50; attempt++) {
    const attemptSeed = attempt === 0 ? seed : `${seed}_${attempt}`;
    const solution = generateSolutionGrid(attemptSeed);
    if (!solution) continue;

    const prng = createPRNG(`${attemptSeed}_remove`);
    const puzzle = [...solution];
    const order = prng.shuffle(Array.from({ length: 81 }, (_, i) => i));

    let failStreak = 0;
    let removed = 0;

    for (let i = 0; i < order.length; i++) {
      if (failStreak >= 20) break;

      const pos = order[i];
      const saved = puzzle[pos];
      puzzle[pos] = 0;

      let keep = false;
      if (hasUniqueSolution(puzzle)) {
        const { solved } = humanSolveSync(puzzle, solution, regions, maxTier);
        if (solved) {
          keep = true;
          removed++;
          failStreak = 0;
        }
      }

      if (!keep) {
        puzzle[pos] = saved;
        failStreak++;
      }

      if ((i + 1) % 5 === 0) {
        postProgress(Math.round(((i + 1) / order.length) * 80));
      }
    }

    const { solved, highestTier, usedTechniques } = humanSolveSync(puzzle, solution, regions, maxTier);
    if (!solved) continue;

    const minRequired = TIER_MIN_REQUIRED[difficulty];
    if (tierIdx(highestTier) < tierIdx(minRequired) && attempt < 49) continue;

    postProgress(100);

    const cells = buildCells(puzzle, solution, regions);
    return {
      cells,
      regions,
      seed: attemptSeed,
      techniques: usedTechniques,
      difficulty: highestTier
    };
  }

  throw new Error(`Could not generate a ${difficulty} puzzle after 50 attempts`);
};

// ─── Worker message handler ───────────────────────────────────────────────────

if (typeof self !== 'undefined') self.onmessage = async (event) => {
  const { type, payload } = event.data;
  if (!type || !payload) return;

  if (type === 'GENERATE') {
    try {
      const result = await generatePuzzleScored(payload.seed, payload.difficulty);
      self.postMessage({ type: 'COMPLETE', payload: result });
    } catch (err) {
      // Fallback to legacy generator if scored generation fails
      try {
        const result = generatePuzzle(payload.seed, payload.difficulty);
        self.postMessage({ type: 'COMPLETE', payload: result });
      } catch (err2) {
        self.postMessage({ type: 'ERROR', payload: { message: err2.message } });
      }
    }
  }
};

// ─── Node.js generation test (not executed in browser worker context) ─────────

if (typeof self === 'undefined') {
  // ── Diagnostic: measure actual scores at various clue counts ────────────────
  console.log('\n═══ SCORING DIAGNOSTICS ═══');
  console.log('Measuring normalizedScore for puzzles with different clue counts...\n');

  const { generateSolutionGrid: genSol } = await import('./generator.js');
  const { hasUniqueSolution: hasUniq } = await import('./solver.js');
  const { createPRNG: mkPRNG } = await import('./prng.js');

  const regions = buildStandardRegions();
  const solution = genSol('diag_seed');
  const prng = mkPRNG('diag_seed_remove');

  // Build a sequence of puzzles by removing clues one at a time
  const puzzle81 = solution.slice();
  const order = prng.shuffle(Array.from({ length: 81 }, (_, i) => i));
  const puzzles = [puzzle81.slice()]; // 81 clues
  const removedSoFar = [];

  for (const pos of order) {
    const test = puzzles[puzzles.length - 1].slice();
    test[pos] = 0;
    if (hasUniq(test, null)) {
      removedSoFar.push(pos);
      puzzles.push(test.slice());
      if (81 - removedSoFar.length <= 17) break; // stop at ~17 clues (hard minimum)
    }
  }

  const clueTargets = [81, 70, 60, 50, 45, 40, 35, 30, 25, 20];
  console.log('Clues | Raw Score   | Norm Score | Complete | Stuck | Techniques');
  console.log('------+-------------+------------+----------+-------+-----------');

  for (const targetClues of clueTargets) {
    const idx = puzzles.findIndex(p => p.filter(v => v !== 0).length <= targetClues);
    if (idx < 0) continue;
    const p = puzzles[idx];
    const actualClues = p.filter(v => v !== 0).length;
    const result = scoredSolve(p, solution, regions, Infinity);
    const row = [
      String(actualClues).padStart(5),
      result.rawScore.toFixed(4).padStart(12),
      result.normalizedScore.toFixed(4).padStart(11),
      result.complete ? '  yes   ' : '  no    ',
      result.stuck   ? '  yes  ' : '  no   ',
      [...new Set(result.techniques)].join(', ')
    ];
    console.log(row.join(' | '));
  }

  console.log('\nSCORE_RANGES (current config):');
  for (const [k, [min, max]] of Object.entries(SCORE_RANGES)) {
    const rawMin = min <= 0 ? 0 : Math.pow(5, min / 2);
    const rawMax = Math.pow(5, max / 2);
    console.log(`  ${k.padEnd(10)}: norm [${min}, ${max}) → raw [${rawMin.toFixed(1)}, ${rawMax.toFixed(1)})`);
  }

  // ── Generation test ──────────────────────────────────────────────────────────
  console.log('\n═══ GENERATION TEST ═══');
  console.log('FAST_SOLVE_MAX_TECHS:', Object.entries(FAST_SOLVE_MAX_TECHS).map(([k,v]) => `${k}=${v}(${TECHNIQUES[v]?.id})`).join(', '));
  const testDifficulties = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD'];

  for (const diff of testDifficulties) {
    const start = Date.now();
    console.log(`\nGenerating ${diff}... (budget: ${NODE_BUDGETS[diff]} nodes)`);

    try {
      const result = await generatePuzzleScored(String(Date.now()), diff);
      const elapsed = Date.now() - start;
      console.log(`  ✓ ${diff} generated in ${elapsed}ms`);
      console.log(`  Final score: ${result.normalizedScore.toFixed(2)} (range: [${SCORE_RANGES[diff].join(', ')}])`);
      console.log(`  Clues: ${result.cells.filter(c => c.fixed).length}`);
      console.log(`  Techniques: ${[...new Set(result.techniques)].join(', ')}`);
    } catch (err) {
      console.log(`  ✗ FAILED: ${err.message}`);
    }
  }
}
