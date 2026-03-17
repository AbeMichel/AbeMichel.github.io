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

      const competitiveBoards = {};
      const initialCells = state.game.cells || [];
      
      // Add local player
      competitiveBoards[state.multiplayer.peerId] = {
        cells: initialCells.map(c => ({ ...c })),
        filledCount: 0,
        totalCells: initialCells.length || 81,
        finished: false,
        finishTime: null
      };

      // Add all peers
      state.multiplayer.peers.forEach(peer => {
        competitiveBoards[peer.id] = {
          cells: initialCells.map(c => ({ ...c })),
          filledCount: 0,
          totalCells: initialCells.length || 81,
          finished: false,
          finishTime: null
        };
      });

      return {
        ...state,
        multiplayer: {
          ...state.multiplayer,
          competitiveBoards,
          lastConfig: action.payload // Store for Play Again
        },
        ui: {
          ...state.ui,
          competitiveResult: null
        }
      };
    }

    default:
      return state;
  }
};
