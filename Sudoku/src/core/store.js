export const createStore = (reducer, initialState = {}) => {
  let state = reducer(undefined, { type: '@@INIT' });
  if (Object.keys(initialState).length > 0) {
    state = { ...state, ...initialState };
  }
  
  const listeners = new Set();
  let activeModifiers = [];

  const getState = () => state;

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const unsubscribe = (listener) => {
    listeners.delete(listener);
  };

  const registerModifiers = (modifierArray) => {
    activeModifiers = modifierArray;
  };

  const dispatch = (action) => {
    let currentAction = action;
    // 1. Run all active modifier onAction hooks
    for (const modifier of activeModifiers) {
      if (modifier.onAction) {
        currentAction = modifier.onAction(state, currentAction, dispatch);
        if (currentAction === null) return;
      }
    }

    // 2. Pass to reducer
    const newState = reducer(state, currentAction);
    
    // 3. Update state
    state = newState;

    // 4. Notify all subscribers with state AND action
    listeners.forEach(listener => listener(state, currentAction));
  };

  return {
    getState,
    dispatch,
    subscribe,
    unsubscribe,
    registerModifiers
  };
};
