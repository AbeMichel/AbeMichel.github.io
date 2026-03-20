import { Actions, clearPlacedByAction } from '../core/actions.js';
import { getDailyConfig, generatePuzzle, generateReconPieces } from '../logic/generator.js';
import { getConflictIds } from '../utils/boardGeometry.js';
import { getRandomPuzzle, getSeededPuzzle, puzzleToGameState, getDailyPuzzle } from './puzzleLoader.js';
import { broadcastAction } from './multiplayerClient.js';

const PIECE_COLORS = [
  '#e8f4fd', '#fdf2e8', '#e8fdf5', '#f5e8fd',
  '#fdfde8', '#e8e8fd', '#fde8e8', '#e8fdfd',
  '#f2fde8', '#fde8f2', '#e8f2fd', '#fdf5e8'
];

const runAutoCandidates = (state, store) => {
  const { cells } = state.game;
  if (!cells) return;
  const candidates = {};
  cells.forEach(cell => {
    if (cell.fixed || cell.v !== null) return;
    const row = Math.floor(cell.id / 9);
    const col = cell.id % 9;
    const used = new Set();
    cells.forEach(c => {
      if (!c.v) return;
      const r = Math.floor(c.id / 9);
      const co = c.id % 9;
      if (r === row || co === col || c.region === cell.region) used.add(c.v);
    });
    const removed = cell.removedCandidates || [];
    candidates[cell.id] = [1,2,3,4,5,6,7,8,9].filter(n => !used.has(n) && !removed.includes(n));
  });
  store.dispatch({ type: Actions.BOARD.SET_ALL_CANDIDATES, payload: { candidates } });
};

const buildReconLoad = (cells, solution, seed, difficulty) => {
  const rawPieces = generateReconPieces(solution, seed);
  const pieces = rawPieces.map((p, idx) => ({
    id: idx,
    cells: p.map(cellIdx => ({
      localRow: Math.floor(cellIdx / 9) - Math.floor(p[0] / 9),
      localCol: (cellIdx % 9) - (p[0] % 9),
      value: solution[cellIdx]
    })),
    placedAt: null,
    rotation: 0,
    mirrored: false,
    color: PIECE_COLORS[idx % PIECE_COLORS.length]
  }));
  pieces.forEach(p => {
    const minR = Math.min(...p.cells.map(c => c.localRow));
    const minC = Math.min(...p.cells.map(c => c.localCol));
    p.cells.forEach(c => { c.localRow -= minR; c.localCol -= minC; });
  });
  const reconConstraints = {
    canRotate: ['HARD', 'VERY_HARD'].includes(difficulty),
    canMirror: ['MEDIUM', 'HARD', 'VERY_HARD'].includes(difficulty)
  };
  return {
    cells: cells.map(c => ({ ...c, v: null, fixed: false })),
    solution,
    pieces,
    reconConstraints
  };
};

export const initGameEffects = (store) => {
  store.subscribe(async (state, action) => {
    if (!action) return;

    // Handle clearing placedBy indicator after a delay when a cell is cleared
    if (action.type === Actions.BOARD.CLEAR_CELL || (action.type === Actions.BOARD.SET_VALUE && (action.payload.value === 0 || action.payload.value == null))) {
      const cellId = action.payload.id;
      setTimeout(() => {
        store.dispatch(clearPlacedByAction(cellId));
      }, 600);
    }

    if (action.type === Actions.GAME.LOAD_DAILY) {
      store.dispatch({ type: 'UI/SET_LOADING', payload: true });
      store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });
      try {
        const gameState = await getDailyPuzzle();
        store.dispatch({
          type: Actions.GAME.START,
          payload: { mode: gameState.mode, difficulty: gameState.difficulty, seed: gameState.seed, _skipGenerate: true }
        });
        store.dispatch({
          type: 'GAME/LOAD',
          payload: { ...gameState, pieces: null, reconConstraints: null }
        });
      } catch (err) {
        console.error('Daily puzzle load failed', err);
        const dateString = new Date().toISOString().split('T')[0];
        const { seed, difficulty } = getDailyConfig(dateString);
        const { cells, regions } = generatePuzzle({ difficulty, seed, mode: 'STANDARD' });
        store.dispatch({ type: Actions.GAME.START, payload: { mode: 'STANDARD', difficulty, seed, _skipGenerate: true } });
        store.dispatch({ type: 'GAME/LOAD', payload: { cells, regions, pieces: null, reconConstraints: null } });
      } finally {
        store.dispatch({ type: 'UI/SET_LOADING', payload: false });
      }
      return;
    }

    if (action.type === Actions.GAME.START && !action.payload._skipGenerate) {
      const { mode, difficulty, seed, chaos, clues, mpMode } = action.payload;
      const resolvedMode = mode || 'STANDARD';
      const resolvedDifficulty = difficulty || 'MEDIUM';
      const resolvedSeed = seed || String(Date.now());

      if (resolvedMode === 'RECONSTRUCTION') {
        // Keep using generator — reconstruction needs custom piece placement
        const { cells, solution, regions } = generatePuzzle({
          difficulty: resolvedDifficulty,
          seed: resolvedSeed,
          mode: 'STANDARD',
          chaos: false,
          clues: clues || null
        });
        const recon = buildReconLoad(cells, solution, resolvedSeed, resolvedDifficulty);
        store.dispatch({ type: 'GAME/LOAD', payload: { cells: recon.cells, regions, pieces: recon.pieces, reconConstraints: recon.reconConstraints } });
        store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });
        return;
      }

      store.dispatch({ type: 'UI/SET_LOADING', payload: true });
      store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });

      try {
        let gameState;
        if (mpMode) {
          // Multiplayer: deterministic by seed so host and guest get the same puzzle
          const puzzleType = resolvedMode === 'CHAOS' ? 'jigsaw' : 'classic';
          const record = await getSeededPuzzle(puzzleType, resolvedDifficulty, resolvedSeed);
          gameState = puzzleToGameState(record);
        } else if (resolvedMode === 'CHAOS') {
          const record = await getRandomPuzzle('jigsaw', resolvedDifficulty);
          gameState = puzzleToGameState(record);
        } else {
          // STANDARD
          const record = await getRandomPuzzle('classic', resolvedDifficulty);
          gameState = puzzleToGameState(record);
        }
        store.dispatch({ type: 'GAME/LOAD', payload: { ...gameState, pieces: null, reconConstraints: null } });
      } catch (err) {
        console.error('Puzzle load failed, falling back to generator', err);
        const { cells, regions } = generatePuzzle({
          difficulty: resolvedDifficulty,
          seed: resolvedSeed,
          mode: resolvedMode === 'CHAOS' ? 'CHAOS' : 'STANDARD',
          chaos: chaos || false,
          clues: clues || null
        });
        store.dispatch({ type: 'GAME/LOAD', payload: { cells, regions, pieces: null, reconConstraints: null } });
      } finally {
        store.dispatch({ type: 'UI/SET_LOADING', payload: false });
      }
    }

    if ((action.type === Actions.BOARD.SET_VALUE ||
         action.type === Actions.BOARD.CLEAR_CELL ||
         action.type === 'INTERNAL/REFRESH_CANDIDATES' ||
         action.type === Actions.RECON.PLACE_PIECE ||
         action.type === Actions.RECON.PICK_UP_PIECE ||
         action.type === Actions.RECON.RETURN_TO_TRAY ||
         action.type === Actions.RECON.RETURN_PIECE) && state.settings?.autoCandidates) {
      runAutoCandidates(state, store);
    }

    if (action.type === 'GAME/LOAD' && state.settings?.autoCandidates) {
      runAutoCandidates(state, store);
    }

    if (action.type === 'SETTINGS/SET' && action.payload.key === 'autoCandidates') {
      if (action.payload.value === true) {
        runAutoCandidates(state, store);
      } else {
        store.dispatch({ type: Actions.BOARD.RESTORE_MANUAL_CANDIDATES });
      }
    }

    if (action.type === Actions.BOARD.SET_VALUE && state.multiplayer.status !== 'PLAYING') {
      const { cells, regions, status } = state.game;
      if (cells && status !== 'WON') {
        const nonFixed = cells.filter(c => !c.fixed);
        if (nonFixed.every(c => c.v > 0) && nonFixed.every(c => c.v === c.solution)) {
          if (getConflictIds(cells, regions).length === 0) {
            store.dispatch({ type: Actions.GAME.WIN });
          }
        }
      }
    }

    // Co-op win detection — standard check skips when multiplayer status is 'PLAYING'
    if (action.type === Actions.BOARD.SET_VALUE && state.multiplayer?.mpMode === 'CO_OP') {
      const { cells, regions, status } = state.game;
      if (cells && status !== 'WON') {
        const nonFixed = cells.filter(c => !c.fixed);
        if (nonFixed.every(c => c.v > 0) && nonFixed.every(c => c.v === c.solution)) {
          if (getConflictIds(cells, regions).length === 0) {
            store.dispatch({ type: Actions.GAME.WIN });
          }
        }
      }
    }

    // Co-op undo/redo sync — broadcast to peers so all boards stay in sync.
    // Not added to SYNCABLE_ACTION_PREFIXES to avoid syncing undo/redo in competitive
    // mode where each player has an independent board.
    if ((action.type === Actions.HISTORY.UNDO || action.type === Actions.HISTORY.REDO) &&
        state.multiplayer?.mpMode === 'CO_OP' &&
        state.multiplayer.status === 'PLAYING' &&
        !action._mpOrigin) {
      broadcastAction({ type: action.type, _mp: { peerId: state.multiplayer.peerId } });
    }

    if (action.type?.startsWith('RECON/') && state._reconWin && state.game.status !== 'WON') {
      store.dispatch({ type: Actions.GAME.WIN });
    }

    if (action.type === Actions.GAME.WIN) {
      const { timer, difficulty } = state.game;
      const bestTimes = { ...state.stats.bestTimes };
      const currentBest = bestTimes[difficulty];

      if (currentBest === undefined || timer < currentBest) {
        bestTimes[difficulty] = timer;
      }

      store.dispatch({
        type: Actions.SYSTEM.STATS_UPDATE,
        payload: {
          stats: {
            bestTimes,
            totalSolved: (state.stats.totalSolved || 0) + 1
          }
        }
      });
    }
  });
};
