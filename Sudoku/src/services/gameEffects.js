import { Actions, clearPlacedByAction } from '../core/actions.js';
import { getDailyConfig } from '../logic/generator.js';

export const initGameEffects = (store) => {
  store.subscribe((state, action) => {
    if (!action) return;

    // Handle clearing placedBy indicator after a delay when a cell is cleared
    if (action.type === Actions.BOARD.CLEAR_CELL || (action.type === Actions.BOARD.SET_VALUE && action.payload.value === 0)) {
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
