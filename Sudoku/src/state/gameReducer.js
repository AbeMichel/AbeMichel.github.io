import { Actions } from '../core/actions.js';
import { generatePuzzle, generateReconPieces } from '../../src/logic/generator.js';

const defaultState = {
  seed: null,
  difficulty: null,
  mode: 'STANDARD',
  cells: [],
  regions: [],
  pieces: null,
  reconConstraints: null,
  timer: 0,
  mistakes: 0,
  isPaused: false,
  status: 'PLAYING'
};

const PIECE_COLORS = [
  '#e8f4fd', '#fdf2e8', '#e8fdf5', '#f5e8fd', 
  '#fdfde8', '#e8e8fd', '#fde8e8', '#e8fdfd',
  '#f2fde8', '#fde8f2', '#e8f2fd', '#fdf5e8'
];

export const gameReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.GAME.START: {
      const { mode, difficulty, seed, chaos, modifiers, clues } = action.payload;
      const resolvedSeed = seed || String(Date.now());
      const resolvedMode = mode || 'STANDARD';
      const resolvedDifficulty = difficulty || 'MEDIUM';

      const { cells, solution, regions } = generatePuzzle({
        difficulty: resolvedDifficulty,
        seed: resolvedSeed,
        mode: resolvedMode === 'RECONSTRUCTION' ? 'STANDARD' : resolvedMode,
        chaos: chaos || false,
        clues: clues || null
      });

      let pieces = null;
      let reconConstraints = null;

      if (resolvedMode === 'RECONSTRUCTION') {
        const rawPieces = generateReconPieces(solution, resolvedSeed);
        pieces = rawPieces.map((p, idx) => ({
          id: idx,
          cells: p.map(cellIdx => ({
            localRow: Math.floor(cellIdx / 9) - Math.floor(p[0] / 9),
            localCol: (cellIdx % 9) - (p[0] % 9),
            value: solution[cellIdx]
          })),
          placedAt: null,
          rotation: 0,
          mirrored: false,
          color: PIECE_COLORS[idx % PIECE_COLORS.length]
        }));

        // Normalize piece local coordinates to top-left (0,0)
        pieces.forEach(p => {
          const minR = Math.min(...p.cells.map(c => c.localRow));
          const minC = Math.min(...p.cells.map(c => c.localCol));
          p.cells.forEach(c => {
            c.localRow -= minR;
            c.localCol -= minC;
          });
        });

        reconConstraints = {
          canRotate: ['HARD', 'VERY_HARD'].includes(resolvedDifficulty),
          canMirror: ['MEDIUM', 'HARD', 'VERY_HARD'].includes(resolvedDifficulty)
        };
      }

      return {
        ...defaultState,
        seed: resolvedSeed,
        difficulty: resolvedDifficulty,
        mode: resolvedMode,
        cells: resolvedMode === 'RECONSTRUCTION' ? cells.map(c => ({ ...c, v: 0, fixed: false })) : cells,
        regions,
        pieces,
        reconConstraints,
        status: 'PLAYING',
        timer: 0,
        mistakes: 0,
        isPaused: false
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
      const { id, value } = action.payload;
      const newCells = state.cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          return { ...cell, v: value };
        }
        return cell;
      });
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.SET_CANDIDATE: {
      const { id, value } = action.payload;
      const newCells = state.cells.map(cell => {
        if (cell.id === id) {
          const candidates = cell.c || [];
          const newCandidates = candidates.includes(value)
            ? candidates.filter(v => v !== value)
            : [...candidates, value].sort();
          return { ...cell, c: newCandidates };
        }
        return cell;
      });
      return { ...state, cells: newCells };
    }
    case Actions.BOARD.CLEAR_CELL: {
      const { id } = action.payload;
      const newCells = state.cells.map(cell => {
        if (cell.id === id && !cell.fixed) {
          return { ...cell, v: 0, c: [] };
        }
        return cell;
      });
      return { ...state, cells: newCells };
    }
    default:
      return state;
  }
};
