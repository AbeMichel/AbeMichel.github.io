import { Actions } from '../core/actions.js';

const defaultState = {
  seed: null,
  difficulty: null,
  mode: 'STANDARD',
  cells: [],
  regions: [],
  pieces: null,
  reconConstraints: null,
  normalizedScore: null,
  techniques: [],
  timer: 0,
  mistakes: 0,
  isPaused: false,
  status: 'PLAYING'
};


export const gameReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.GAME.START: {
      const { mode, difficulty, seed } = action.payload;
      const resolvedSeed = seed || String(Date.now());
      const resolvedMode = mode || 'STANDARD';
      const resolvedDifficulty = difficulty || 'MEDIUM';
      return {
        ...defaultState,
        seed: resolvedSeed,
        difficulty: resolvedDifficulty,
        mode: resolvedMode,
        status: 'PLAYING',
        timer: 0,
        mistakes: 0,
        isPaused: false
      };
    }

    case 'GAME/LOAD': {
      const { cells, regions, pieces, reconConstraints, seed, difficulty, mode, normalizedScore, techniques } = action.payload;
      return {
        ...state,
        cells: cells.map(c => ({ ...c, placedBy: null, manualCandidates: [], autoCandidates: [], removedCandidates: [] })),
        regions,
        pieces: pieces || null,
        reconConstraints: reconConstraints || null,
        ...(seed !== undefined && { seed }),
        ...(difficulty !== undefined && { difficulty }),
        ...(mode !== undefined && { mode }),
        ...(normalizedScore !== undefined && { normalizedScore }),
        ...(techniques !== undefined && { techniques })
      };
    }

    case Actions.GAME.LOAD_DAILY:
      return state;

    case Actions.GAME.TICK:
      return { ...state, timer: state.timer + action.payload.elapsed };
    case Actions.GAME.PAUSE:
      return { ...state, isPaused: true };
    case Actions.GAME.RESUME:
      return { ...state, isPaused: false };
    case Actions.GAME.WIN:
      return { ...state, status: 'WON' };
    case Actions.BOARD.SET_VALUE: {
      const { id, value, peerId } = action.payload;
      let mistakeIncrement = 0;
      const newCells = state.cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          const v = value === 0 ? null : value;
          if (v != null && v !== cell.solution) mistakeIncrement = 1;
          return { ...cell, v, placedBy: peerId, removedCandidates: [] };
        }
        return cell;
      });
      return { ...state, cells: newCells, mistakes: state.mistakes + mistakeIncrement };
    }
    case Actions.BOARD.SET_CANDIDATE: {
      const { id, value, autoCandidates } = action.payload;
      return {
        ...state,
        cells: state.cells.map(cell => {
          if (cell.id !== id || cell.fixed || cell.v !== null) return cell;

          if (autoCandidates) {
            // Auto mode: toggle displayed c via removedCandidates; leave manualCandidates alone
            const isDisplayed = (cell.c || []).includes(value);
            if (isDisplayed) {
              return {
                ...cell,
                c: (cell.c || []).filter(v => v !== value),
                removedCandidates: [...(cell.removedCandidates || []), value]
              };
            } else {
              return {
                ...cell,
                c: [...(cell.c || []), value].sort(),
                removedCandidates: (cell.removedCandidates || []).filter(v => v !== value)
              };
            }
          } else {
            // Manual mode: toggle manualCandidates and mirror to c; leave autoCandidates/removedCandidates alone
            const isIn = (cell.manualCandidates || []).includes(value);
            const newManual = isIn
              ? (cell.manualCandidates || []).filter(v => v !== value)
              : [...(cell.manualCandidates || []), value].sort();
            return { ...cell, manualCandidates: newManual, c: newManual };
          }
        })
      };
    }
    case Actions.BOARD.CLEAR_CELL: {
      const { id } = action.payload;
      const peerId = action._mp?.peerId || null;
      const newCells = state.cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          return { ...cell, v: null, placedBy: peerId, removedCandidates: [] };
        }
        return cell;
      });
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.SET_ALL_CANDIDATES: {
      const { candidates } = action.payload;
      const newCells = state.cells.map(cell => {
        if (cell.fixed || cell.v !== null) return cell;
        const computed = candidates[cell.id];
        if (computed === undefined) return cell;
        // Store computed values in autoCandidates; display them in c (auto mode owns c)
        return { ...cell, autoCandidates: computed, c: computed };
      });
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.RESTORE_MANUAL_CANDIDATES: {
      const newCells = state.cells.map(cell => {
        if (cell.fixed || cell.v !== null) return cell;
        // Switch c back to manualCandidates; autoCandidates stays intact
        return { ...cell, c: [...(cell.manualCandidates || [])] };
      });
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.CLEAR_CANDIDATES: {
      const { id } = action.payload;
      const newCells = state.cells.map(cell =>
        cell.id === id && !cell.fixed ? { ...cell, c: [] } : cell
      );
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.CLEAR_PLACED_BY: {
      const { id } = action.payload;
      const newCells = state.cells.map(cell => {
        if (cell.id === id) {
          return { ...cell, placedBy: null };
        }
        return cell;
      });
      return { ...state, cells: newCells };
    }
    default:
      return state;
  }
};
