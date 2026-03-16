import { Actions, resetGameAction } from '../core/actions.js';

export const FragileModifier = {
  id: 'FRAGILE',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_VALUE) {
      const { id, value } = action.payload;
      const cell = state.game.cells.find(c => c.id === id);

      // If the placed value is wrong, block and reset
      if (cell && value !== null && value !== cell.solution) {
        dispatch(resetGameAction());
        return null;
      }
    }
    return action;
  },

  initialModState: () => null,

  getCssClasses: (state) => ['mod-fragile']
};
