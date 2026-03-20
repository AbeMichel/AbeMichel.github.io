import { Actions, modTriggerAction } from '../core/actions.js';

export const LivingModifier = {
  id: 'LIVING',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.MOD.TICK) {
      const modState = state.modifiers.modState['LIVING'];
      if (modState && modState.nextSwapAt && Date.now() >= modState.nextSwapAt) {
        const swapTypes = ['ROW', 'COL', 'TRANSPOSE'];
        const type = swapTypes[Math.floor(Math.random() * swapTypes.length)];
        let indexA, indexB;

        if (type !== 'TRANSPOSE') {
          const band = Math.floor(Math.random() * 3);
          const i = Math.floor(Math.random() * 3);
          let j = Math.floor(Math.random() * 3);
          while (i === j) j = Math.floor(Math.random() * 3);
          indexA = band * 3 + i;
          indexB = band * 3 + j;
        }

        dispatch(modTriggerAction('LIVING', {
          swap: { type, indexA, indexB },
          nextSwapAt: Date.now() + modState.interval,
          lastSwap: Date.now()
        }));
      }
    }
    return action;
  },

  initialModState: () => ({ 
    interval: 30000, 
    nextSwapAt: Date.now() + 30000, 
    lastSwap: null 
  }),

  getCssClasses: (state) => ['mod-living']
};
