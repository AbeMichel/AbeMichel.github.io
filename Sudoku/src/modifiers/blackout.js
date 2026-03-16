import { Actions, modTriggerAction } from '../core/actions.js';

export const BlackoutModifier = {
  id: 'BLACKOUT',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.UI.SELECT_CELL) {
      const selectedId = action.payload.id;
      const modState = state.modifiers.modState['BLACKOUT'];
      if (modState && !modState.revealed.includes(selectedId)) {
        dispatch(modTriggerAction('BLACKOUT', { 
          revealed: [...modState.revealed, selectedId] 
        }));
      }
    }
    return action;
  },

  initialModState: () => ({ 
    revealed: [], 
    revealScope: 'CELL' 
  }),

  getCssClasses: (state) => ['mod-blackout']
};
