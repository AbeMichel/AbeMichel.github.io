import { Actions } from '../core/actions.js';

const KEYS = {
  GAME: 'sudoku2_game',
  SETTINGS: 'sudoku2_settings',
  STATS: 'sudoku2_stats',
  ACHIEVEMENTS: 'sudoku2_achievements'
};

export const initPersistence = (store) => {
  store.subscribe((state, action) => {
    if (!action) return;

    switch (action.type) {
      case Actions.BOARD.SET_VALUE:
      case Actions.BOARD.SET_CANDIDATE:
      case Actions.BOARD.CLEAR_CELL:
      case Actions.BOARD.MOVE_PIECE:
      case Actions.GAME.START:
      case Actions.GAME.RESET:
      case Actions.GAME.WIN:
      case Actions.GAME.PAUSE:
        localStorage.setItem(KEYS.GAME, JSON.stringify(state.game));
        if (action.type === Actions.GAME.WIN || action.type === Actions.GAME.START || action.type === Actions.GAME.RESET) {
          localStorage.setItem(KEYS.STATS, JSON.stringify(state.stats));
        }
        break;
      
      case Actions.SYSTEM.SETTINGS_UPDATE:
        localStorage.setItem(KEYS.SETTINGS, JSON.stringify(state.settings));
        break;
      
      case Actions.SYSTEM.STATS_UPDATE:
        localStorage.setItem(KEYS.STATS, JSON.stringify(state.stats));
        break;
      
      case Actions.SYSTEM.ACHIEVEMENTS_UNLOCK:
        localStorage.setItem(KEYS.ACHIEVEMENTS, JSON.stringify(state.achievements));
        break;
    }
  });

  window.addEventListener('beforeunload', () => {
    const state = store.getState();
    localStorage.setItem(KEYS.GAME, JSON.stringify(state.game));
  });
};

export const loadPersistedState = () => {
  const state = {};
  try {
    const game = localStorage.getItem(KEYS.GAME);
    if (game) state.game = JSON.parse(game);

    const settings = localStorage.getItem(KEYS.SETTINGS);
    if (settings) state.settings = JSON.parse(settings);

    const stats = localStorage.getItem(KEYS.STATS);
    if (stats) state.stats = JSON.parse(stats);

    const achievements = localStorage.getItem(KEYS.ACHIEVEMENTS);
    if (achievements) state.achievements = JSON.parse(achievements);
  } catch (e) {
    console.error('Failed to parse persisted state', e);
  }
  return state;
};
