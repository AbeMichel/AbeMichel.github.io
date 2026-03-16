import { gameReducer } from '../state/gameReducer.js';
import { uiReducer } from '../state/uiReducer.js';
import { modifierReducer } from '../state/modifierReducer.js';
import { mpReducer } from '../state/mpReducer.js';
import { statsReducer } from '../state/statsReducer.js';
import { reconReducer } from '../state/reconReducer.js';
import { settingsReducer } from '../state/settingsReducer.js';
import { historyReducer } from './history.js';
import { Actions } from './actions.js';

const defaultSettings = { darkMode: true, regionColors: true };
const defaultAchievements = [];

export const rootReducer = (state = {}, action) => {
  const previousGameSlice = state.game;
  
  // Handle RECON actions via reconReducer
  if (action.type.startsWith('RECON/')) {
    let newState = reconReducer(state, action);
    
    // Handle signals from reconReducer
    if (newState._reconReturnPiece !== undefined) {
      const pieceId = newState._reconReturnPiece;
      delete newState._reconReturnPiece;
      return rootReducer(state, { type: Actions.RECON.RETURN_PIECE, payload: { pieceId } });
    }
    if (newState._reconWin) {
      delete newState._reconWin;
      return rootReducer(newState, { type: Actions.GAME.WIN });
    }
    
    // Standard history logic for RECON actions that reached here
    const historyState = historyReducer(state.history, action, newState.game, previousGameSlice);
    newState.history = historyState;
    return newState;
  }

  // 1. Initial Domain Reducers
  let newState = {
    game: gameReducer(state.game, action),
    ui: uiReducer(state.ui, action),
    multiplayer: mpReducer(state.multiplayer, action),
    stats: statsReducer(state.stats, action),
    settings: settingsReducer(state.settings, action),
    achievements: state.achievements || defaultAchievements,
    history: state.history
  };

  // 2. Modifier Reducer
  const modifierState = modifierReducer(state.modifiers, action, newState.game);
  if (modifierState._reorderCells) {
    newState.game = { ...newState.game, cells: modifierState._reorderCells };
    delete modifierState._reorderCells;
  }
  newState.modifiers = modifierState;

  // 3. System Updates
  if (action.type === Actions.SYSTEM.ACHIEVEMENTS_UNLOCK) {
    if (!newState.achievements.includes(action.payload.id)) {
      newState.achievements = [...newState.achievements, action.payload.id];
    }
  }

  // 4. History Orchestration
  const historyState = historyReducer(
    state.history, 
    action, 
    newState.game, 
    previousGameSlice
  );

  if (historyState._restored) {
    newState.game = historyState._restored;
    const { _restored, ...cleanHistory } = historyState;
    newState.history = cleanHistory;
  } else {
    newState.history = historyState;
  }

  return newState;
};
