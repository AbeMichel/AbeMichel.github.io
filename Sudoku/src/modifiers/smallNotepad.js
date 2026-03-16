import { Actions } from '../core/actions.js';

export const SmallNotepadModifier = {
  id: 'SMALL_NOTEPAD',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_CANDIDATE) {
      const { id, value } = action.payload;
      const cell = state.game.cells.find(c => c.id === id);
      
      // If we're ADDING a candidate, check limit
      if (cell && !cell.c.includes(value)) {
        const totalCandidates = state.game.cells.reduce((sum, currentCell) => sum + (currentCell.c ? currentCell.c.length : 0), 0);
        const modState = state.modifiers.modState['SMALL_NOTEPAD'];
        if (modState && totalCandidates >= modState.limit) {
          return null; // Block adding
        }
      }
    }
    return action;
  },

  initialModState: () => ({ limit: 30 }),

  getCssClasses: (state) => ['mod-small-notepad']
};
