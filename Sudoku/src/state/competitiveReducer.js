import { Actions } from '../core/actions.js';

export const competitiveReducer = (state, action) => {
  switch (action.type) {
    case Actions.COMPETITIVE.UPDATE_BOARD: {
      const { peerId, cells, filledCount, finished, finishTime, mistakes } = action.payload;
      return {
        ...state,
        multiplayer: {
          ...state.multiplayer,
          competitiveBoards: {
            ...state.multiplayer.competitiveBoards,
            [peerId]: { cells, filledCount, finished, finishTime, mistakes }
          }
        }
      };
    }

    case Actions.COMPETITIVE.SET_RESULT: {
      return {
        ...state,
        ui: {
          ...state.ui,
          competitiveResult: action.payload
        }
      };
    }

    case Actions.GAME.START: {
      if (action.payload.mpMode !== 'COMPETITIVE') return state;
      // Reset boards; actual cell initialization happens in GAME/LOAD once
      // cells are available. Storing lastConfig here for Play Again support.
      return {
        ...state,
        multiplayer: {
          ...state.multiplayer,
          competitiveBoards: {},
          lastConfig: action.payload
        },
        ui: {
          ...state.ui,
          competitiveResult: null
        }
      };
    }

    case 'GAME/LOAD': {
      if (state.multiplayer?.mpMode !== 'COMPETITIVE') return state;
      // state.game.cells is already populated by gameReducer (rootReducer runs
      // gameReducer before competitiveReducer), so we read from state.game.cells.
      const cells = state.game?.cells || [];
      const peers = state.multiplayer?.peers || [];
      const localId = state.multiplayer?.peerId;

      const boards = {};
      peers.forEach(peer => {
        boards[peer.id] = {
          cells: cells.map(c => ({ ...c })),
          filledCount: 0,
          totalCells: cells.length || 81,
          finished: false,
          finishTime: null
        };
      });
      if (localId && !boards[localId]) {
        boards[localId] = {
          cells: cells.map(c => ({ ...c })),
          filledCount: 0,
          totalCells: cells.length || 81,
          finished: false,
          finishTime: null
        };
      }

      return {
        ...state,
        multiplayer: {
          ...state.multiplayer,
          competitiveBoards: boards
        }
      };
    }

    default:
      return state;
  }
};
