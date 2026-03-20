import { Actions } from '../core/actions.js';

const defaultState = {
  view: 'TITLE',
  selectedId: null,
  inputMode: 'VALUE',
  activeModal: null,
  paletteHue: 200,
  flashingCells: {},
  competitiveResult: null,
  competitiveVotes: {},
  showWinModal: false,
  viewingSolution: false,
  showSettings: false,
  loading: false
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
    case Actions.UI.FLASH_CELL:
      return {
        ...state,
        flashingCells: {
          ...state.flashingCells,
          [action.payload.id]: action.payload.flashType
        }
      };
    case Actions.UI.CLEAR_FLASH: {
      const newFlashes = { ...state.flashingCells };
      delete newFlashes[action.payload.id];
      return { ...state, flashingCells: newFlashes };
    }
    case 'UI/SET_LOADING':
      return { ...state, loading: action.payload };
    case 'UI/OPEN_SETTINGS':
      return { ...state, showSettings: true };
    case 'UI/CLOSE_SETTINGS':
      return { ...state, showSettings: false };
    case Actions.GAME.WIN:
      return { ...state, showWinModal: true, viewingSolution: false };
    case 'UI/CLOSE_WIN_MODAL':
      return { ...state, showWinModal: false, viewingSolution: true };
    case 'UI/SHOW_WIN_MODAL':
      return { ...state, showWinModal: true, viewingSolution: false };
    case Actions.GAME.START:
      return { ...state, showWinModal: false, viewingSolution: false, competitiveVotes: {} };
    case Actions.COMPETITIVE.SET_RESULT:
      return { ...state, competitiveResult: action.payload, competitiveVotes: {}, showWinModal: true, viewingSolution: false };
    case Actions.COMPETITIVE.CAST_VOTE:
      return { ...state, competitiveVotes: { ...state.competitiveVotes, [action.payload.peerId]: action.payload.vote } };
    case Actions.MP.RETURN_TO_LOBBY:
      return { ...state, view: 'LOBBY', competitiveResult: null, competitiveVotes: {}, showWinModal: false, viewingSolution: false };
    default:
      return state;
  }
};
