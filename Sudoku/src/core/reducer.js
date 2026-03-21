import { gameReducer } from '../state/gameReducer.js';
import { uiReducer } from '../state/uiReducer.js';
import { modifierReducer } from '../state/modifierReducer.js';
import { mpReducer } from '../state/mpReducer.js';
import { statsReducer } from '../state/statsReducer.js';
import { reconReducer } from '../state/reconReducer.js';
import { settingsReducer } from '../state/settingsReducer.js';
import { challengesReducer } from '../state/challengesReducer.js';
import { competitiveReducer } from '../state/competitiveReducer.js';
import { historyReducer } from './history.js';
import { Actions } from './actions.js';

const defaultSettings = { darkMode: true, regionColors: true };
const defaultAchievements = [];

/**
 * Pure helper to apply a board action to a cells array.
 */
const applyBoardActionToCells = (cells, action) => {
  switch (action.type) {
    case Actions.BOARD.SET_VALUE: {
      const { id, value, peerId } = action.payload;
      return cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          return { ...cell, v: value, placedBy: peerId || null };
        }
        return cell;
      });
    }
    case Actions.BOARD.SET_CANDIDATE: {
      const { id, value } = action.payload;
      return cells.map(cell => {
        if (cell.id === id) {
          const candidates = cell.c || [];
          const newCandidates = candidates.includes(value)
            ? candidates.filter(v => v !== value)
            : [...candidates, value].sort();
          return { ...cell, c: newCandidates };
        }
        return cell;
      });
    }
    case Actions.BOARD.CLEAR_CELL: {
      const { id, peerId } = action.payload;
      return cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          return { ...cell, v: 0, c: [], placedBy: peerId || null };
        }
        return cell;
      });
    }
    default:
      return cells;
  }
};

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

  // Check if it's an opponent board action in competitive mode before domain reducers
  if (
    state.multiplayer?.mpMode === 'COMPETITIVE' &&
    action._mp?.peerId &&
    action._mp.peerId !== state.multiplayer.peerId &&
    (action.type === Actions.BOARD.SET_VALUE || action.type === Actions.BOARD.SET_CANDIDATE || action.type === Actions.BOARD.CLEAR_CELL)
  ) {
    const opponentPeerId = action._mp.peerId;
    const opponentBoard = state.multiplayer.competitiveBoards?.[opponentPeerId];
    if (opponentBoard) {
      const updatedCells = applyBoardActionToCells(opponentBoard.cells, action);
      const filledCount = updatedCells.filter(c => !c.fixed && c.v > 0).length;
      return {
        ...state,
        multiplayer: {
          ...state.multiplayer,
          competitiveBoards: {
            ...state.multiplayer.competitiveBoards,
            [opponentPeerId]: {
              ...opponentBoard,
              cells: updatedCells,
              filledCount
            }
          }
        }
      };
    }
    return state;
  }

  // 1. Initial Domain Reducers
  let newState = {
    game: gameReducer(state.game, action),
    ui: uiReducer(state.ui, action),
    multiplayer: mpReducer(state.multiplayer, action),
    stats: statsReducer(state.stats, action),
    settings: settingsReducer(state.settings, action),
    challenges: challengesReducer(state.challenges, action),
    achievements: state.achievements || defaultAchievements,
    history: state.history
  };

  // 2. MP State Sync
  if (action.type === Actions.MP.SYNC_STATE) {
    newState.game = action.payload.gameState;
  }

  // 3. Competitive Reducer
  newState = competitiveReducer(newState, action);

  // 4. Modifier Reducer
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
