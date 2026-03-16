import { Actions } from '../core/actions.js';

const defaultState = { 
  darkMode: false, 
  regionColors: false,
  showPlayerColors: true
};

export const settingsReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.SYSTEM.SETTINGS_UPDATE:
      return { ...state, ...action.payload.settings };
    default:
      return state;
  }
};
