import { Actions } from '../core/actions.js';

export const NoCandidatesModifier = {
  id: 'NO_CANDIDATES',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.BOARD.SET_CANDIDATE) {
      return null;
    }
    return action;
  },

  initialModState: () => null,

  getCssClasses: (state) => ['mod-no-candidates']
};
