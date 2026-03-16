import { Actions } from '../core/actions.js';

export const OrderedModifier = {
  id: 'ORDERED',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_VALUE) {
      const { value } = action.payload;
      if (value === null) return action; // Clearing is allowed

      // Calculate the current required digit
      let requiredDigit = 1;
      for (let d = 1; d <= 9; d++) {
        const count = state.game.cells.filter(c => c.v === d && c.v === c.solution).length;
        if (count < 9) {
          requiredDigit = d;
          break;
        }
      }

      if (value !== requiredDigit) {
        return null; // Block if not the required digit
      }
    }
    return action;
  },

  initialModState: () => null,

  getCssClasses: (state) => ['mod-ordered']
};
