import { Actions } from '../core/actions.js';

export const OrderedModifier = {
  id: 'ORDERED',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_VALUE) {
      const { value } = action.payload;
      if (value === null) return action; // Clearing is allowed

      const direction = state.modifiers.modState['ORDERED']?.direction || 'ASC';
      const digits = direction === 'DESC' ? [9,8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8,9];

      // Find the first digit that doesn't yet have all 9 correctly placed
      let requiredDigit = digits[0];
      for (const d of digits) {
        const count = state.game.cells.filter(c => c.v === d && c.v === c.solution).length;
        if (count < 9) {
          requiredDigit = d;
          break;
        }
      }

      if (value !== requiredDigit) {
        return null;
      }
    }
    return action;
  },

  initialModState: () => ({ direction: 'ASC' }),

  getCssClasses: (state) => ['mod-ordered']
};
