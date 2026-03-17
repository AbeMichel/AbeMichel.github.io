import { generatePuzzle } from '../logic/generator.js';
import { findNextStep } from '../logic/humanSolver.js';
import { gameReducer } from '../state/gameReducer.js';
import { initGameEffects } from './gameEffects.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
    if (typeof process !== 'undefined') process.exitCode = 1;
  }
};

// ── Mock Store ────────────────────────────────────────────────────────────────

function createMockStore(initialState) {
  let state = initialState;
  const subscribers = [];
  return {
    getState: () => state,
    dispatch(action) {
      const newGame = gameReducer(state.game, action);
      let newStats = state.stats;
      if (action.type === 'STATS/UPDATE') {
        newStats = { ...state.stats, ...action.payload.stats };
      }
      state = { ...state, game: newGame, stats: newStats };
      [...subscribers].forEach(s => s(state, action));
    },
    subscribe(fn) {
      subscribers.push(fn);
      return () => subscribers.splice(subscribers.indexOf(fn), 1);
    }
  };
}

// ── Puzzle classifier ─────────────────────────────────────────────────────────

// Returns false if the puzzle can be solved using only NAKED_SINGLE/HIDDEN_SINGLE,
// i.e. returns true if elimination techniques are required.
function requiresEliminationTechnique(cells, regions) {
  // Work with empty c so getCandidates freshly computes from grid values each call
  const working = cells.map(c => ({ ...c, c: [] }));

  for (let step = 0; step < 300; step++) {
    const remaining = working.filter(c => !c.fixed && c.v === null);
    if (remaining.length === 0) return false; // solved with basic only

    const result = findNextStep(working, regions);
    if (!result) return true; // stuck — solver can't proceed with available techniques
    if (!['NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(result.techniqueId)) return true;

    if (result.placement) {
      working[result.placement.id] = { ...working[result.placement.id], v: result.placement.value, c: [] };
    }
  }
  return true;
}

// ── Direct hint runner (no worker) ───────────────────────────────────────────

function applyHintDirect(store) {
  const MAX_ATTEMPTS = 15;
  const exhausted = new Set();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const cells = store.getState().game.cells;
    const regions = store.getState().game.regions;

    const result = findNextStep(cells, regions);
    if (!result) return { applied: false, techniqueId: null };

    const key = result.techniqueId + JSON.stringify([...result.cellIds].sort());
    if (exhausted.has(key)) continue;

    if (result.placement) {
      store.dispatch({
        type: 'BOARD/SET_VALUE',
        payload: { id: result.placement.id, value: result.placement.value }
      });
      return { applied: true, techniqueId: result.techniqueId };
    }

    if (result.eliminations) {
      const freshCells = store.getState().game.cells;
      const pending = result.eliminations.filter(elim => {
        const cell = freshCells.find(c => c.id === elim.id);
        return cell && cell.c.includes(elim.value);
      });

      if (pending.length === 0) {
        exhausted.add(key);
        continue;
      }

      const autoCandidates = store.getState().settings?.autoCandidates || false;
      pending.forEach(elim => {
        store.dispatch({
          type: 'BOARD/SET_CANDIDATE',
          payload: { id: elim.id, value: elim.value, autoCandidates }
        });
      });
      if (autoCandidates) {
        store.dispatch({ type: 'INTERNAL/REFRESH_CANDIDATES' });
      }
      return { applied: true, techniqueId: result.techniqueId };
    }
  }

  return { applied: false, techniqueId: null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

export const runTests = () => {
  console.log('--- Running Hint System Tests ---');

  // 1. Find a HARD puzzle that requires elimination techniques
  let testPuzzle = null;
  let foundAtSeed = null;

  for (let seed = 1; seed <= 100; seed++) {
    const puzzle = generatePuzzle({ difficulty: 'HARD', seed: String(seed), mode: 'STANDARD' });
    const cells = puzzle.cells.map(c => ({
      ...c,
      c: [],
      manualCandidates: [],
      autoCandidates: [],
      removedCandidates: []
    }));
    if (requiresEliminationTechnique(cells, puzzle.regions)) {
      testPuzzle = { ...puzzle, cells };
      foundAtSeed = seed;
      break;
    }
  }

  assert(testPuzzle !== null, 'Found a puzzle requiring elimination techniques (seeds 1–100)');
  if (!testPuzzle) return;
  console.log(`  Using seed ${foundAtSeed} (HARD)`);

  // 2. Set up mock store with full game state
  const store = createMockStore({
    game: {
      cells: testPuzzle.cells,
      regions: testPuzzle.regions,
      status: 'PLAYING',
      timer: 0,
      mistakes: 0,
      isPaused: false,
      mode: 'STANDARD',
      difficulty: 'HARD',
      seed: String(foundAtSeed)
    },
    settings: { autoCandidates: true },
    multiplayer: { status: null },
    stats: { totalSolved: 0, bestTimes: {} }
  });

  initGameEffects(store);

  // Seed initial auto candidates
  store.dispatch({ type: 'INTERNAL/REFRESH_CANDIDATES' });

  // 3. Run hints to completion with stall detection
  const MAX_HINTS = 150;
  const STALL_LIMIT = 15;

  let iterations = 0;
  let lastFilledCount = 0;
  let stalledFor = 0;
  let lastTechniqueId = null;

  while (store.getState().game.status !== 'WON' && iterations < MAX_HINTS) {
    const { applied, techniqueId } = applyHintDirect(store);

    if (!applied) {
      const cells = store.getState().game.cells;
      const empty = cells.filter(c => !c.fixed && c.v === null);
      const zeroCands = empty.filter(c => !c.c || c.c.length === 0);
      console.log('Solver returned null.');
      console.log('Unsolved cells:', empty.length);
      console.log('Cells with 0 candidates:', zeroCands.length);
      console.log('Zero-candidate cells:',
        JSON.stringify(zeroCands.slice(0, 5).map(c => ({
          id: c.id,
          c: c.c,
          removed: c.removedCandidates,
          auto: c.autoCandidates
        })))
      );
      assert(false, `Hint system returned null after ${iterations} hints — solver has no technique (${empty.length} unsolved, ${zeroCands.length} with 0 candidates)`);
      return;
    }

    if (techniqueId) lastTechniqueId = techniqueId;
    iterations++;

    const filledNow = store.getState().game.cells.filter(c => c.v !== null && !c.fixed).length;

    if (filledNow > lastFilledCount) {
      lastFilledCount = filledNow;
      stalledFor = 0;
    } else {
      stalledFor++;
    }

    if (stalledFor >= STALL_LIMIT) {
      const remaining = store.getState().game.cells.filter(c => c.v === null && !c.fixed);
      const sample = JSON.stringify(remaining.slice(0, 3).map(c => ({ id: c.id, c: c.c })));
      assert(false,
        `Hint system stalled for ${STALL_LIMIT} hints. ` +
        `${remaining.length} cells unsolved. Filled: ${filledNow}. ` +
        `Last technique: ${lastTechniqueId}. ` +
        `Sample unsolved: ${sample}`
      );
      return;
    }
  }

  assert(
    store.getState().game.status === 'WON',
    `Puzzle solved to completion without stalling (${iterations} hints applied, last technique: ${lastTechniqueId})`
  );
};
