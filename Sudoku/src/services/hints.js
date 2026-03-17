import { humanSolver } from '../logic/humanSolverClient.js';
import { Actions } from '../core/actions.js';

async function findAndApplyHint(store) {
  const MAX_ATTEMPTS = 15;
  const exhausted = new Set();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const state = store.getState();
    const cells = state.game.cells;
    const regions = state.game.regions;

    const result = await humanSolver.hintNextTechnique(cells, regions);

    if (!result) return;

    const key = result.techniqueId + JSON.stringify([...result.cellIds].sort());

    if (exhausted.has(key)) continue;

    if (result.placement) {
      store.dispatch({
        type: Actions.BOARD.SET_VALUE,
        payload: { id: result.placement.id, value: result.placement.value }
      });
      store.dispatch({
        type: Actions.SYSTEM.STATS_UPDATE,
        payload: { stats: { hintsUsed: (store.getState().stats.hintsUsed || 0) + 1 } }
      });
      return;
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
          type: Actions.BOARD.SET_CANDIDATE,
          payload: { id: elim.id, value: elim.value, autoCandidates, peerId: null }
        });
      });
      if (store.getState().settings?.autoCandidates) {
        store.dispatch({ type: 'INTERNAL/REFRESH_CANDIDATES' });
      }
      store.dispatch({
        type: Actions.UI.OPEN_MODAL,
        payload: {
          modal: 'HINT',
          data: { techniqueId: result.techniqueId, cellIds: result.cellIds, description: result.description }
        }
      });
      store.dispatch({
        type: Actions.SYSTEM.STATS_UPDATE,
        payload: { stats: { hintsUsed: (store.getState().stats.hintsUsed || 0) + 1 } }
      });
      return;
    }
  }

  console.warn('hints: no applicable technique found after', MAX_ATTEMPTS, 'attempts');
}

export const initHints = (store) => {
  store.subscribe(async (state, action) => {
    if (action.type === Actions.GAME.HINT) {
      await findAndApplyHint(store);
    }
  });
};
