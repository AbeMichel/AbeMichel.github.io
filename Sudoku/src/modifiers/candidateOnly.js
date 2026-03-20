import { Actions } from '../core/actions.js';

export const CandidateOnlyModifier = {
  id: 'CANDIDATE_ONLY',

  onAction: (state, action, dispatch) => {
    // We used to block manual SET_VALUE here; now we allow it for better UX,
    // but the modifier's core value is the auto-fill helper below.

    // When a candidate is added/removed, check if the cell now has exactly one
    // candidate that matches the solution — if so, auto-fill it.
    if (action.type === Actions.BOARD.SET_CANDIDATE) {
      const { id, value } = action.payload;
      const cell = state.game.cells.find(c => c.id === id);
      if (cell && !cell.fixed && cell.v === null) {
        const current = cell.c || [];
        const next = current.includes(value)
          ? current.filter(v => v !== value)
          : [...current, value];
        if (next.length === 1 && next[0] === cell.solution) {
          dispatch({ type: Actions.BOARD.SET_VALUE, payload: { id, value: next[0] }, _autoFill: true });
        }
      }
    }
    return action;
  },

  initialModState: () => null,

  getCssClasses: (state) => ['mod-candidate-only']
};
