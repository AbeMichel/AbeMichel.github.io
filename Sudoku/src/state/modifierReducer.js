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

    case Actions.GAME.START: {
      // Payload may supply a new modifier list and per-modifier config overrides.
      const newActive = action.payload?.modifiers || [];
      const configs   = action.payload?.modifierConfig || {};
      const activeMods = getActiveModifiers(newActive);
      const newModState = {};
      activeMods.forEach(mod => {
        const base = mod.initialModState();
        newModState[mod.id] = base === null ? null : { ...base, ...(configs[mod.id] || {}) };
      });
      return { ...state, active: newActive, modState: newModState, _configSnapshot: configs };
    }

    case Actions.GAME.RESET: {
      // Preserve config overrides but reinitialise runtime state.
      const configs = state._configSnapshot || {};
      const activeMods = getActiveModifiers(state.active);
      const newModState = {};
      activeMods.forEach(mod => {
        const base = mod.initialModState();
        if (base === null) {
          newModState[mod.id] = null;
        } else {
          const merged = { ...base, ...(configs[mod.id] || {}) };
          // Recalculate any interval-based countdown using the merged interval
          if ('interval' in merged && 'nextSwapAt' in merged) {
            merged.nextSwapAt = Date.now() + merged.interval;
          }
          newModState[mod.id] = merged;
        }
      });
      return { ...state, modState: newModState };
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
