import { Actions } from '../core/actions.js';
import { rotateCells, mirrorCells, hasOverlap, getCellsAtPosition } from '../utils/pieceGeometry.js';
import { getConflictIds } from '../utils/boardGeometry.js';

export const reconReducer = (state, action) => {
  switch (action.type) {
    case Actions.RECON.PICK_UP_PIECE: {
      const { pieceId } = action.payload;
      const piece = state.game.pieces.find(p => p.id === pieceId);
      if (!piece) return state;

      // If piece was placed, remove its values from the board
      let newCells = state.game.cells;
      if (piece.placedAt !== null) {
        const boardIds = getCellsAtPosition(piece, piece.placedAt.boardRow, piece.placedAt.boardCol);
        if (boardIds) {
          newCells = state.game.cells.map(cell => 
            boardIds.includes(cell.id) ? { ...cell, v: 0 } : cell
          );
        }
      }

      const newPieces = state.game.pieces.map(p => 
        p.id === pieceId ? { 
          ...p, 
          held: true, 
          placedAt: null,
          lastPlacedAt: p.placedAt,
          lastRotation: p.rotation,
          lastMirrored: p.mirrored,
          lastCells: p.cells
        } : p
      );

      return {
        ...state,
        game: { ...state.game, pieces: newPieces, cells: newCells },
        ui: { ...state.ui, selectedPieceId: pieceId }
      };
    }

    case Actions.RECON.PLACE_PIECE: {
      const { pieceId, boardRow, boardCol } = action.payload;
      const piece = state.game.pieces.find(p => p.id === pieceId);
      if (!piece) return state;

      if (hasOverlap(piece, boardRow, boardCol, state.game.pieces)) {
        // Overlap detected, return to last position
        return { ...state, _reconReturnPiece: pieceId };
      }

      // Update board cells with piece values
      const boardIds = getCellsAtPosition(piece, boardRow, boardCol);
      const newCells = state.game.cells.map(cell => {
        const localCell = piece.cells.find(lc => 
          (boardRow + lc.localRow) * 9 + (boardCol + lc.localCol) === cell.id
        );
        return localCell ? { ...cell, v: localCell.value } : cell;
      });

      const newPieces = state.game.pieces.map(p => 
        p.id === pieceId ? { ...p, held: false, placedAt: { boardRow, boardCol } } : p
      );

      const nextGameState = { ...state.game, pieces: newPieces, cells: newCells };
      
      // Check Win Condition
      const allPlaced = newPieces.every(p => p.placedAt !== null);
      const conflicts = getConflictIds(newCells, state.game.regions);
      if (allPlaced && conflicts.length === 0) {
        return { ...state, game: nextGameState, _reconWin: true };
      }

      return { ...state, game: nextGameState };
    }

    case Actions.RECON.RETURN_PIECE: {
      const { pieceId } = action.payload;
      const piece = state.game.pieces.find(p => p.id === pieceId);
      if (!piece) return state;

      if (piece.lastPlacedAt) {
        // Restore to last position
        const { boardRow, boardCol } = piece.lastPlacedAt;
        const newPieces = state.game.pieces.map(p => 
          p.id === pieceId ? { 
            ...p, 
            held: false, 
            placedAt: piece.lastPlacedAt,
            rotation: piece.lastRotation,
            mirrored: piece.lastMirrored,
            cells: piece.lastCells
          } : p
        );
        const newCells = state.game.cells.map(cell => {
          const localCell = piece.lastCells.find(lc => 
            (boardRow + lc.localRow) * 9 + (boardCol + lc.localCol) === cell.id
          );
          return localCell ? { ...cell, v: localCell.value } : cell;
        });
        return { ...state, game: { ...state.game, pieces: newPieces, cells: newCells } };
      } else {
        // Return to tray
        const newPieces = state.game.pieces.map(p => 
          p.id === pieceId ? { 
            ...p, 
            held: false, 
            placedAt: null,
            cells: piece.lastCells || piece.cells
          } : p
        );
        return { ...state, game: { ...state.game, pieces: newPieces } };
      }
    }

    case Actions.RECON.RETURN_TO_TRAY: {
      const { pieceId } = action.payload;
      const piece = state.game.pieces.find(p => p.id === pieceId);
      if (!piece) return state;

      const newPieces = state.game.pieces.map(p => 
        p.id === pieceId ? { 
          ...p, 
          held: false, 
          placedAt: null, 
          lastPlacedAt: null,
          cells: piece.lastCells || piece.cells
        } : p
      );
      return { ...state, game: { ...state.game, pieces: newPieces } };
    }

    case Actions.RECON.ROTATE_PIECE: {
      const { pieceId, direction } = action.payload;
      if (!state.game.reconConstraints.canRotate) return state;
      const newPieces = state.game.pieces.map(p => 
        p.id === pieceId ? { ...p, cells: rotateCells(p.cells, direction) } : p
      );
      return { ...state, game: { ...state.game, pieces: newPieces } };
    }

    case Actions.RECON.MIRROR_PIECE: {
      const { pieceId } = action.payload;
      if (!state.game.reconConstraints.canMirror) return state;
      const newPieces = state.game.pieces.map(p => 
        p.id === pieceId ? { ...p, cells: mirrorCells(p.cells) } : p
      );
      return { ...state, game: { ...state.game, pieces: newPieces } };
    }

    case Actions.RECON.SELECT_PIECE: {
      return { ...state, ui: { ...state.ui, selectedPieceId: action.payload.pieceId } };
    }

    default:
      return state;
  }
};
