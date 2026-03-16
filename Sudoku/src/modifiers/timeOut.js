import { Actions, resetGameAction, modTriggerAction } from '../core/actions.js';

export const TimeOutModifier = {
  id: 'TIME_OUT',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.MOD.TICK) {
      const modState = state.modifiers.modState['TIME_OUT'];
      if (modState && state.game.timer >= modState.duration) {
        dispatch(resetGameAction());
        dispatch(modTriggerAction('TIME_OUT', { triggered: true }));
      }
    }
    return action;
  },

  initialModState: () => ({ 
    duration: 300000, 
    triggered: false 
  }),

  getCssClasses: (state) => ['mod-timeout']
};
