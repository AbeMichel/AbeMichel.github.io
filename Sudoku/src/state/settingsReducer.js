import { Actions } from '../core/actions.js';

const defaultState = {
  darkMode: false,
  regionColors: true,
  showPlayerColors: true,
  showOpponentBoard: true,
  highlightPeers: true,
  showTimer: true,
  showMistakes: true,
  autoCandidates: false
};

function loadSettings() {
  try {
    const saved = localStorage.getItem('sudoku_settings');
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch { return defaultState; }
}

const initialState = loadSettings();

export const settingsReducer = (state = initialState, action) => {
  switch (action.type) {
    case Actions.SYSTEM.SETTINGS_UPDATE:
      return { ...state, ...action.payload.settings };
    case 'SETTINGS/SET':
      return { ...state, [action.payload.key]: action.payload.value };
    default:
      return state;
  }
};
