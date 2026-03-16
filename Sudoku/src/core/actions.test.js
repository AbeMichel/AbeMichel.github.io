import { Actions, setValueAction, startGameAction, selectCellAction } from './actions.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Actions Tests ---');

  const valAction = setValueAction(0, 5);
  assert(valAction.type === Actions.BOARD.SET_VALUE, 'setValueAction type is correct');
  assert(valAction.payload.id === 0 && valAction.payload.value === 5, 'setValueAction payload is correct');

  const startAction = startGameAction('seed123', 'HARD', 'STANDARD');
  assert(startAction.type === Actions.GAME.START, 'startGameAction type is correct');
  assert(startAction.payload.seed === 'seed123', 'startGameAction payload seed is correct');

  const selectAction = selectCellAction(10);
  assert(selectAction.type === Actions.UI.SELECT_CELL, 'selectCellAction type is correct');
  assert(selectAction.payload.id === 10, 'selectCellAction payload id is correct');
};
