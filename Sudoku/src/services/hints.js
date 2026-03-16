import { humanSolver } from '../logic/humanSolverClient.js';
import { Actions } from '../core/actions.js';

export const initHints = (store) => {
  store.subscribe(async (state, action) => {
    if (action.type === Actions.GAME.HINT) {
      const result = await humanSolver.hintNextTechnique(state.game.cells, state.game.regions);
      
      if (!result) return;

      const { techniqueId, cellIds, eliminations, placement, description } = result;

      if (placement) {
        store.dispatch({ 
          type: Actions.BOARD.SET_VALUE, 
          payload: { id: placement.id, value: placement.value } 
        });
      } else if (eliminations) {
        // Apply eliminations
        for (const elim of eliminations) {
          // Toggle off the candidate if it exists
          const cell = state.game.cells.find(c => c.id === elim.id);
          if (cell && cell.c.includes(elim.value)) {
            store.dispatch({ 
              type: Actions.BOARD.SET_CANDIDATE, 
              payload: { id: elim.id, value: elim.value } 
            });
          }
        }
        // Open hint modal with explanation
        store.dispatch({ 
          type: Actions.UI.OPEN_MODAL, 
          payload: { 
            modal: 'HINT', 
            data: { techniqueId, cellIds, description } 
          } 
        });
      }

      // Update stats
      store.dispatch({ 
        type: Actions.SYSTEM.STATS_UPDATE, 
        payload: { stats: { hintsUsed: (state.stats.hintsUsed || 0) + 1 } } 
      });
    }
  });
};
