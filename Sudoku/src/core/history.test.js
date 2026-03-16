import { historyReducer } from './history.js';
import { Actions } from './actions.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running History Tests ---');

  let state = { past: [], future: [] };
  let game0 = { v: 0 };
  let game1 = { v: 1 };
  let game2 = { v: 2 };

  // 1. Normal action pushes to past
  const action1 = { type: Actions.BOARD.SET_VALUE };
  state = historyReducer(state, action1, game1, game0);
  assert(state.past.length === 1, 'Action pushes to past');
  assert(state.past[0] === game0, 'Past contains previous game state');

  // 2. Another action
  const action2 = { type: Actions.BOARD.SET_VALUE };
  state = historyReducer(state, action2, game2, game1);
  assert(state.past.length === 2, 'Second action pushes to past');

  // 3. Undo restores previous game state
  const undoAction = { type: Actions.HISTORY.UNDO };
  state = historyReducer(state, undoAction, game2, game2);
  assert(state._restored === game1, 'Undo restores game1');
  assert(state.past.length === 1, 'Undo removes from past');
  assert(state.future.length === 1, 'Undo adds to future');
  assert(state.future[0] === game2, 'Future contains undone state');
  delete state._restored;

  // 4. Redo restores undone state
  const redoAction = { type: Actions.HISTORY.REDO };
  state = historyReducer(state, redoAction, game1, game1);
  assert(state._restored === game2, 'Redo restores game2');
  assert(state.past.length === 2, 'Redo adds back to past');
  assert(state.future.length === 0, 'Redo removes from future');
  delete state._restored;

  // 5. GAME/TICK does not push to history
  const tickAction = { type: Actions.GAME.TICK };
  let game3 = { v: 3 };
  state = historyReducer(state, tickAction, game3, game2);
  assert(state.past.length === 2, 'GAME/TICK ignored for history');

  // 6. Capped at 100 entries
  state = { past: Array(100).fill({}), future: [] };
  state = historyReducer(state, action1, { v: 'new' }, { v: 'old' });
  assert(state.past.length === 100, 'Past capped at 100');
};
