import { Actions } from '../core/actions.js';

export const CandidateOnlyModifier = {
  id: 'CANDIDATE_ONLY',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_VALUE) {
      return null;
    }
    return action;
  },

  initialModState: () => null,

  getCssClasses: (state) => ['mod-candidate-only']
};
