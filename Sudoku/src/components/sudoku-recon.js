import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { repeat } from 'https://esm.sh/lit@3/directives/repeat.js';
import './sudoku-cell.js';
import { getConflictIds, getRegionBorderClasses } from '../utils/boardGeometry.js';
import { getSnapPosition, hasOverlap, getCellsAtPosition, getBoundingBox, getPieceBorderClasses, getCenterOffset } from '../utils/pieceGeometry.js';
import { getRegionColor } from '../config/regionColors.js';

export class SudokuRecon extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    modifiers: { type: Object },
    settingsState: { type: Object },
    multiplayerState: { type: Object },
    _dragAnimClass: { type: String }
  };

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      width: min(90vw, 540px);
      height: min(90vw, 540px);
      margin: 0 auto;
      border: 2px solid var(--board-border-color, #333);
      box-sizing: border-box;
      outline: none;
      position: relative;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .grid {
      display: contents;
    }

    .drag-preview {
      position: absolute;
      pointer-events: none;
      opacity: 0.7;
      z-index: 100;
      display: grid;
      gap: 1px;
    }

    .preview-cell {
      width: var(--cell-size);
      height: var(--cell-size);
      background: var(--piece-color);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      color: #333;
      box-shadow:
        inset 2px 2px 4px rgba(255, 255, 255, 0.5),
        inset -2px -2px 4px rgba(0, 0, 0, 0.2);
      border-radius: 2px;
    }

    @keyframes rotate-cw {
      from { transform: rotate(-90deg) scale(0.8); opacity: 0.5; }
      to   { transform: rotate(0deg) scale(1); opacity: 1; }
    }
    @keyframes rotate-ccw {
      from { transform: rotate(90deg) scale(0.8); opacity: 0.5; }
      to   { transform: rotate(0deg) scale(1); opacity: 1; }
    }
    @keyframes mirror-flip {
      0%   { transform: scaleX(1); }
      50%  { transform: scaleX(0); }
      100% { transform: scaleX(1); }
    }

    .animating-cw    { animation: rotate-cw   0.2s ease-out; }
    .animating-ccw   { animation: rotate-ccw  0.2s ease-out; }
    .animating-mirror { animation: mirror-flip 0.2s ease-out; }

    .preview-valid   { background-color: var(--recon-drop-valid)   !important; }
    .preview-invalid { background-color: var(--recon-drop-invalid) !important; }
  `;

  constructor() {
    super();
    this.tabIndex = 0;
    this._dragState = null;
    this._dragAnimClass = '';
  }

  _triggerDragAnim(animClass) {
    if (!this._dragState) return;
    this._dragAnimClass = animClass;
    setTimeout(() => {
      this._dragAnimClass = '';
      this.requestUpdate();
    }, 200);
  }

  reinitialize() {
    this.focus();
  }

  beginDrag(pieceId, clientX, clientY) {
    const boardRect = this.getBoundingClientRect();
    const cellSize = boardRect.width / 9;
    const piece = this.gameState.pieces.find(p => p.id === pieceId);
    if (!piece) return;
    const { x: centerOffsetX, y: centerOffsetY } = getCenterOffset(piece, cellSize);
    this._dragState = {
      pieceId,
      currentX: clientX,
      currentY: clientY,
      boardRect,
      cellSize,
      centerOffsetX,
      centerOffsetY,
      boardRow: -1,
      boardCol: -1
    };
    this.requestUpdate();
  }

  updateDrag(clientX, clientY) {
    if (!this._dragState) return;
    const { boardRect, cellSize, centerOffsetX, centerOffsetY } = this._dragState;
    const { boardRow, boardCol } = getSnapPosition(
      clientX - centerOffsetX,
      clientY - centerOffsetY,
      boardRect,
      cellSize
    );
    this._dragState = { ...this._dragState, currentX: clientX, currentY: clientY, boardRow, boardCol };
    this.requestUpdate();
  }

  endDrag() {
    this._dragState = null;
    this.requestUpdate();
  }

  getHitPieceId(clientX, clientY) {
    const boardRect = this.getBoundingClientRect();
    const cellSize = boardRect.width / 9;
    const col = Math.floor((clientX - boardRect.left) / cellSize);
    const row = Math.floor((clientY - boardRect.top) / cellSize);
    const cellId = row * 9 + col;
    const piece = this.gameState.pieces.find(p => {
      if (!p.placedAt) return false;
      const ids = getCellsAtPosition(p, p.placedAt.boardRow, p.placedAt.boardCol);
      return ids?.includes(cellId);
    });
    return piece?.id ?? null;
  }

  render() {
    if (!this.gameState?.cells) return html`<div>Loading...</div>`;

    const conflictIds = getConflictIds(this.gameState.cells, this.gameState.regions);
    let previewCells = [];
    let isValidPlacement = false;
    let pieceToPreview = null;

    if (this._dragState) {
      const piece = this.gameState.pieces.find(p => p.id === this._dragState.pieceId);
      if (piece) {
        pieceToPreview = piece;
        const targetIds = getCellsAtPosition(piece, this._dragState.boardRow, this._dragState.boardCol);
        if (targetIds) {
          previewCells = targetIds;
          isValidPlacement = !hasOverlap(piece, this._dragState.boardRow, this._dragState.boardCol, this.gameState.pieces);
        }
      }
    }

    const cellIdToPiece = new Map();
    this.gameState.pieces.forEach(p => {
      if (p.placedAt !== null) {
        const ids = getCellsAtPosition(p, p.placedAt.boardRow, p.placedAt.boardCol);
        if (ids) ids.forEach(id => cellIdToPiece.set(id, p));
      }
    });

    return html`
      <div class="grid">
        ${repeat(this.gameState.cells, (cell) => cell.id, (cell) => {
          const isPreview = previewCells.includes(cell.id);

          const borderClasses = getRegionBorderClasses(cell.id, this.gameState.regions);
          const modifierClasses = this.modifiers ? this.modifiers.active : [];

          const piece = cellIdToPiece.get(cell.id);
          const pieceBorderClasses = getPieceBorderClasses(cell.id, piece);

          const allModClasses = [...modifierClasses, ...borderClasses];
          if (piece) {
            allModClasses.push('has-piece');
            allModClasses.push(...pieceBorderClasses);
          }
          if (isPreview) allModClasses.push(isValidPlacement ? 'preview-valid' : 'preview-invalid');
          if (!isPreview && piece && conflictIds.includes(cell.id)) allModClasses.push('recon-conflict');

          const regionColor = (this.settingsState?.regionColors && !piece) ? getRegionColor(cell.region) : '';
          const flashType = this.uiState.flashingCells?.[cell.id] || '';

          let placedByColor = '';
          if (this.multiplayerState?.mpMode === 'CO_OP' && this.settingsState?.showPlayerColors && cell.placedBy) {
            const peer = this.multiplayerState.peers.find(p => p.id === cell.placedBy);
            if (peer) placedByColor = peer.color;
          }

          return html`
            <sudoku-cell
              .cellId="${cell.id}"
              .value="${cell.v || 0}"
              .candidates="${cell.c || []}"
              .fixed="${cell.fixed}"
              .regionIndex="${cell.region}"
              .regionColor="${regionColor}"
              .flashType="${flashType}"
              .placedByColor="${placedByColor}"
              .pieceColor="${piece?.color || ''}"
              .pieceBorderClasses="${pieceBorderClasses}"
              ?selected="${this.uiState.selectedId === cell.id}"
              ?conflict="${conflictIds.includes(cell.id)}"
              .modClasses="${allModClasses}"
            ></sudoku-cell>
          `;
        })}
      </div>

      ${this._dragState && pieceToPreview ? html`
        <div class="drag-preview ${this._dragAnimClass}" style="
          left: ${this._dragState.currentX - this._dragState.boardRect.left - this._dragState.centerOffsetX}px;
          top: ${this._dragState.currentY - this._dragState.boardRect.top - this._dragState.centerOffsetY}px;
          grid-template-columns: repeat(${getBoundingBox(pieceToPreview.cells).cols}, 1fr);
          --cell-size: ${this._dragState.cellSize}px;
          --piece-color: ${pieceToPreview.color};
        ">
          ${pieceToPreview.cells.map(c => html`
            <div class="preview-cell" style="grid-row: ${c.localRow + 1}; grid-column: ${c.localCol + 1}">
              ${c.value}
            </div>
          `)}
        </div>
      ` : ''}
    `;
  }
}

customElements.define('sudoku-recon', SudokuRecon);
