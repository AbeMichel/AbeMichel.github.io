import { Actions } from '../core/actions.js';
import { getActiveModifiers } from '../modifiers/registry.js';

const defaultState = {
  active: [],
  modState: {}
};

export const modifierReducer = (state = defaultState, action, gameSlice) => {
  switch (action.type) {
    case Actions.MOD.TRIGGER: {
      const { modifierId, ...data } = action.payload;
      let nextState = {
        ...state,
        modState: {
          ...state.modState,
          [modifierId]: {
            ...state.modState[modifierId],
            ...data
          }
        }
      };

      // Special handling for LIVING swaps
      if (modifierId === 'LIVING' && data.swap && gameSlice) {
        const { type, indexA, indexB } = data.swap;
        const cells = [...gameSlice.cells];
        
        if (type === 'ROW') {
          for (let c = 0; c < 9; c++) {
            const i = indexA * 9 + c;
            const j = indexB * 9 + c;
            [cells[i], cells[j]] = [cells[j], cells[i]];
          }
        } else if (type === 'COL') {
          for (let r = 0; r < 9; r++) {
            const i = r * 9 + indexA;
            const j = r * 9 + indexB;
            [cells[i], cells[j]] = [cells[j], cells[i]];
          }
        } else if (type === 'TRANSPOSE') {
          for (let r = 0; r < 9; r++) {
            for (let c = r + 1; c < 9; c++) {
              const i = r * 9 + c;
              const j = c * 9 + r;
              [cells[i], cells[j]] = [cells[j], cells[i]];
            }
          }
        }
        nextState._reorderCells = cells;
      }
      return nextState;
    }

    case Actions.GAME.START:
    case Actions.GAME.RESET: {
      const activeMods = getActiveModifiers(state.active);
      const newModState = {};
      activeMods.forEach(mod => {
        newModState[mod.id] = mod.initialModState();
      });
      return {
        ...state,
        modState: newModState,
        active: state.active // Preserve active mods
      };
    }

    case Actions.BOARD.SET_VALUE: {
      if (state.active.includes('DECAYING')) {
        const { id, value } = action.payload;
        const modState = state.modState['DECAYING'];
        if (!modState) return state;
        
        if (value === null) {
          const newExpiry = { ...modState.expiry };
          delete newExpiry[id];
          return {
            ...state,
            modState: { ...state.modState, DECAYING: { ...modState, expiry: newExpiry } }
          };
        } else {
          const expiryTime = Date.now() + modState.duration;
          return {
            ...state,
            modState: {
              ...state.modState,
              DECAYING: {
                ...modState,
                expiry: { ...modState.expiry, [id]: expiryTime }
              }
            }
          };
        }
      }
      return state;
    }

    default:
      return state;
  }
};
