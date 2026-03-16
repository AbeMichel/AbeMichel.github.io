import { Actions, tickAction, modTickAction } from '../core/actions.js';

let interval = null;

export const initTimer = (store) => {
  if (interval) clearInterval(interval);
  
  interval = setInterval(() => {
    const state = store.getState();
    if (state.game.status === 'PLAYING' && !state.game.isPaused) {
      store.dispatch(tickAction(100)); // Actions creator tickAction(elapsed)
    }
    // Always tick modifiers so they can handle their own intervals/logic if active
    store.dispatch(modTickAction());
  }, 100);
};

export const destroyTimer = () => {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
};
