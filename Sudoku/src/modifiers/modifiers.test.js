import { MODIFIERS, getModifier, getActiveModifiers } from './registry.js';
import { Actions } from '../core/actions.js';
import { getSymbol } from './symbols.js';
import { createStore } from '../core/store.js';
import { rootReducer } from '../core/reducer.js';

const assert = (condition, description) => {
  if (condition) {
    console.log(`PASS: ${description}`);
  } else {
    console.error(`FAIL: ${description}`);
  }
};

export const runTests = () => {
  console.log('--- Running Modifiers Tests ---');

  // 1. Registry
  assert(getModifier('FRAGILE').id === 'FRAGILE', 'getModifier returns correct object');
  assert(getActiveModifiers(['FRAGILE', 'SYMBOLS']).length === 2, 'getActiveModifiers filters correctly');
  assert(MODIFIERS.length === 10, 'All 10 modifiers registered');
  assert(MODIFIERS.every(m => m.id && m.onAction && m.getCssClasses), 'Modifiers have correct shape');

  // 2. Fragile
  const fragileMod = getModifier('FRAGILE');
  const mockState = { game: { cells: [{ id: 0, solution: 5 }] } };
  let resetDispatched = false;
  let mockDispatch = (action) => { if (action.type === Actions.GAME.RESET) resetDispatched = true; };
  assert(fragileMod.onAction(mockState, { type: Actions.BOARD.SET_VALUE, payload: { id: 0, value: 3 } }, mockDispatch) === null, 'Fragile blocks wrong value');
  assert(resetDispatched === true, 'Fragile dispatches reset');

  // 3. No Candidates
  const noCandMod = getModifier('NO_CANDIDATES');
  assert(noCandMod.onAction({}, { type: Actions.BOARD.SET_CANDIDATE }) === null, 'No Candidates blocks SET_CANDIDATE');

  // 4. Candidate Only
  const candOnlyMod = getModifier('CANDIDATE_ONLY');
  assert(candOnlyMod.onAction({}, { type: Actions.BOARD.SET_VALUE }) === null, 'Candidate Only blocks SET_VALUE');

  // 5. Blackout
  const blackoutMod = getModifier('BLACKOUT');
  let triggerDispatched = false;
  mockDispatch = (action) => { if (action.type === Actions.MOD.TRIGGER && action.payload.modifierId === 'BLACKOUT') triggerDispatched = true; };
  const blackoutState = { modifiers: { modState: { BLACKOUT: { revealed: [] } } } };
  const blackoutAction = blackoutMod.onAction(blackoutState, { type: Actions.UI.SELECT_CELL, payload: { id: 10 } }, mockDispatch);
  assert(blackoutAction.type === Actions.UI.SELECT_CELL, 'Blackout passes SELECT_CELL');
  assert(triggerDispatched === true, 'Blackout dispatches TRIGGER to reveal');

  // 6. Time Out
  const timeoutMod = getModifier('TIME_OUT');
  resetDispatched = false;
  const timeoutState = { game: { timer: 400000 }, modifiers: { modState: { TIME_OUT: { duration: 300000 } } } };
  timeoutMod.onAction(timeoutState, { type: Actions.MOD.TICK }, (a) => { if (a.type === Actions.GAME.RESET) resetDispatched = true; });
  assert(resetDispatched === true, 'Time Out dispatches reset when timer > duration');

  // 7. Ordered
  const orderedMod = getModifier('ORDERED');
  // Mock cells: 8 correct 1s, one missing 1
  const cellsOrdered = Array.from({length: 81}, (_, i) => ({ id: i, v: i < 8 ? 1 : null, solution: 1 }));
  const orderedState = { game: { cells: cellsOrdered } };
  assert(orderedMod.onAction(orderedState, { type: Actions.BOARD.SET_VALUE, payload: { value: 1 } }, () => {}) !== null, 'Ordered allows required digit');
  assert(orderedMod.onAction(orderedState, { type: Actions.BOARD.SET_VALUE, payload: { value: 2 } }, () => {}) === null, 'Ordered blocks non-required digit');

  // 8. Small Notepad
  const smallMod = getModifier('SMALL_NOTEPAD');
  const cellsSmall = [{ id: 0, c: [1, 2, 3] }, { id: 1, c: [4, 5, 6] }]; // 6 total
  const smallState = { game: { cells: cellsSmall }, modifiers: { modState: { SMALL_NOTEPAD: { limit: 5 } } } };
  assert(smallMod.onAction(smallState, { type: Actions.BOARD.SET_CANDIDATE, payload: { id: 0, value: 7 } }, () => {}) === null, 'Small Notepad blocks when over limit');

  // 9. Living
  const livingMod = getModifier('LIVING');
  triggerDispatched = false;
  const livingState = { modifiers: { modState: { LIVING: { nextSwapAt: 1000, interval: 30000 } } } };
  // Mock Date.now() or just pass a state where nextSwapAt is in the past
  const originalDateNow = Date.now;
  Date.now = () => 2000;
  livingMod.onAction(livingState, { type: Actions.MOD.TICK }, (a) => { if (a.type === Actions.MOD.TRIGGER) triggerDispatched = true; });
  assert(triggerDispatched === true, 'Living dispatches TRIGGER when nextSwapAt passed');
  Date.now = originalDateNow;
};
