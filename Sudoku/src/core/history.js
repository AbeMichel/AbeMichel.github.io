import { Actions } from './actions.js';

const defaultState = {
  past: [],
  future: []
};

const HISTORY_LIMIT = 100;

const IGNORED_ACTIONS = [
  Actions.HISTORY.UNDO,
  Actions.HISTORY.REDO,
  Actions.GAME.TICK,
  Actions.MOD.TICK
];

const RECORDABLE_ACTIONS = [
  Actions.BOARD.SET_VALUE,
  Actions.BOARD.SET_CANDIDATE,
  Actions.BOARD.CLEAR_CELL,
  Actions.BOARD.MOVE_PIECE,
  Actions.RECON.PLACE_PIECE,
  Actions.RECON.RETURN_TO_TRAY
];

export const historyReducer = (state = defaultState, action, currentGameSlice, previousGameSlice) => {
  switch (action.type) {
    case Actions.HISTORY.UNDO: {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, state.past.length - 1);
      // Merge current removedCandidates into restored cells so manual removals survive undo
      const currentRemovedById = {};
      (currentGameSlice.cells || []).forEach(c => {
        if (c.removedCandidates?.length) currentRemovedById[c.id] = c.removedCandidates;
      });
      const restoredCells = (previous.cells || []).map(c => ({
        ...c,
        removedCandidates: currentRemovedById[c.id] || c.removedCandidates || []
      }));
      return {
        past: newPast,
        future: [currentGameSlice, ...state.future].slice(0, HISTORY_LIMIT),
        _restored: { ...previous, cells: restoredCells, timer: currentGameSlice.timer, mistakes: currentGameSlice.mistakes }
      };
    }
    case Actions.HISTORY.REDO: {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      // Merge current removedCandidates into restored cells
      const currentRemovedById = {};
      (currentGameSlice.cells || []).forEach(c => {
        if (c.removedCandidates?.length) currentRemovedById[c.id] = c.removedCandidates;
      });
      const restoredCells = (next.cells || []).map(c => ({
        ...c,
        removedCandidates: currentRemovedById[c.id] || c.removedCandidates || []
      }));
      return {
        past: [...state.past, currentGameSlice].slice(-HISTORY_LIMIT),
        future: newFuture,
        _restored: { ...next, cells: restoredCells, timer: currentGameSlice.timer, mistakes: currentGameSlice.mistakes }
      };
    }
    case Actions.GAME.START:
      return defaultState;

    default: {
      if (IGNORED_ACTIONS.includes(action.type)) return state;
      if (!RECORDABLE_ACTIONS.includes(action.type)) return state;
      
      // If the game slice hasn't changed, don't record history
      if (JSON.stringify(currentGameSlice) === JSON.stringify(previousGameSlice)) return state;

      const snapshot = { ...previousGameSlice };
      delete snapshot.timer;
      delete snapshot.mistakes;
      return {
        past: [...state.past, snapshot].slice(-HISTORY_LIMIT),
        future: []
      };
    }
  }
};
