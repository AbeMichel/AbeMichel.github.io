import { Actions } from '../core/actions.js';

const defaultState = {
  view: 'MENU',
  selectedId: null,
  inputMode: 'VALUE',
  activeModal: null,
  paletteHue: 200
};

export const uiReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.UI.SELECT_CELL:
      return { ...state, selectedId: action.payload.id };
    case Actions.UI.SET_INPUT_MODE:
      return { ...state, inputMode: action.payload.mode };
    case Actions.UI.SET_VIEW:
      return { ...state, view: action.payload.view };
    case Actions.UI.OPEN_MODAL:
      return { ...state, activeModal: action.payload.modal };
    case Actions.UI.CLOSE_MODAL:
      return { ...state, activeModal: null };
    default:
      return state;
  }
};
