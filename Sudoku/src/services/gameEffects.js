import { Actions, clearPlacedByAction } from '../core/actions.js';
import { getDailyConfig } from '../logic/generator.js';
import { getConflictIds } from '../utils/boardGeometry.js';

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

export const initGameEffects = (store) => {
  store.subscribe((state, action) => {
    if (!action) return;

    // Handle clearing placedBy indicator after a delay when a cell is cleared
    if (action.type === Actions.BOARD.CLEAR_CELL || (action.type === Actions.BOARD.SET_VALUE && (action.payload.value === 0 || action.payload.value == null))) {
      const cellId = action.payload.id;
      setTimeout(() => {
        store.dispatch(clearPlacedByAction(cellId));
      }, 600);
    }

    if (action.type === Actions.GAME.LOAD_DAILY) {
      const dateString = new Date().toISOString().split('T')[0];
      const { seed, difficulty } = getDailyConfig(dateString);
      store.dispatch({
        type: Actions.GAME.START,
        payload: {
          seed,
          difficulty,
          mode: 'STANDARD'
        }
      });
      store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });
    }

    if ((action.type === Actions.BOARD.SET_VALUE || action.type === Actions.BOARD.CLEAR_CELL || action.type === 'INTERNAL/REFRESH_CANDIDATES') && state.settings?.autoCandidates) {
      runAutoCandidates(state, store);
    }

    if (action.type === Actions.GAME.START && state.settings?.autoCandidates) {
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
