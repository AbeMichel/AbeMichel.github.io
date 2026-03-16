import { createStore } from './store.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

const mockReducer = (state = { count: 0 }, action) => {
  if (action.type === 'INC') return { ...state, count: state.count + 1 };
  if (action.type === 'SET') return { ...state, count: action.payload };
  return state;
};

export const runTests = () => {
  console.log('--- Running Store Tests ---');

  // 1. Initial State
  const store = createStore(mockReducer);
  assert(store.getState().count === 0, 'Initial state is correct');

  // 2. Dispatch
  store.dispatch({ type: 'INC' });
  assert(store.getState().count === 1, 'Dispatch updates state');

  // 3. Subscribe
  let notified = false;
  store.subscribe((state) => { notified = state.count === 2; });
  store.dispatch({ type: 'INC' });
  assert(notified === true, 'Subscriber is notified');

  // 4. Modifiers - Blocking
  const blockingModifier = {
    onAction: (state, action) => action.type === 'SET' ? null : action
  };
  store.registerModifiers([blockingModifier]);
  store.dispatch({ type: 'SET', payload: 100 });
  assert(store.getState().count === 2, 'Modifier can block action');

  // 5. Modifiers - Transforming
  const transformingModifier = {
    onAction: (state, action) => {
      if (action.type === 'SET') {
        return { ...action, payload: action.payload * 2 };
      }
      return action;
    }
  };
  store.registerModifiers([transformingModifier]);
  store.dispatch({ type: 'SET', payload: 10 });
  assert(store.getState().count === 20, 'Modifier can transform action');
};
