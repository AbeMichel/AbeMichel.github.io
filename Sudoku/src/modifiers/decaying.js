import { Actions, clearCellAction, modTriggerAction } from '../core/actions.js';

export const DecayingModifier = {
  id: 'DECAYING',

  onAction: (state, action, dispatch) => {
    // on BOARD/SET_VALUE, action is pass-through (handled in reducer for state update)
    if (action.type === Actions.MOD.TICK) {
      const modState = state.modifiers.modState['DECAYING'];
      if (!modState || !modState.expiry) return action;

      const now = Date.now();
      for (const [cellId, expiryTime] of Object.entries(modState.expiry)) {
        if (now >= expiryTime) {
          // Dispatch clear action and remove from expiry list
          dispatch(clearCellAction(Number(cellId)));
          dispatch(modTriggerAction('DECAYING', { 
            expiry: { ...modState.expiry, [cellId]: undefined } 
          }));
        }
      }
    }
    return action;
  },

  initialModState: () => ({ 
    duration: 30000, 
    expiry: {} 
  }),

  getCssClasses: (state) => ['mod-decaying']
};
