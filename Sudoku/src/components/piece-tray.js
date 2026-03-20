import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { getBoundingBox } from '../utils/pieceGeometry.js';

export class PieceTray extends LitElement {
  static properties = {
    pieces: { type: Array },
    selectedPieceId: { type: Number },
    reconConstraints: { type: Object },
    availableHeight: { type: Number },
    availableWidth: { type: Number },
    _hoveredPieceId: { type: Number },
    _hoverPos: { type: Object },
    _animatingPieceId: { type: Number },
    _animationType: { type: String }
  };

  static styles = css`
    :host {
      display: flex;
      flex-wrap: wrap;
      align-content: space-evenly;
      justify-content: space-evenly;
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      padding: 8px;
      gap: 6px;
      background: var(--tray-bg);
      border-radius: 8px;
      overflow: hidden;
      position: relative;
      user-select: none;
      -webkit-user-select: none;
    }

    .piece-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border: 2px solid transparent;
      border-radius: 4px;
      background: var(--piece-grid-bg);
      cursor: grab;
      touch-action: none;
      filter: var(--piece-container-shadow);
      transition: filter 0.15s ease, transform 0.15s ease;
      box-sizing: border-box;
      -webkit-user-drag: none;
      user-drag: none;
    }

    .piece-container:active {
      cursor: grabbing;
    }

    .piece-container:hover {
      filter: var(--piece-container-shadow-hover);
      transform: translateY(-1px);
    }

    .piece-container.is-selected {
      border-color: var(--piece-grid-selected);
    }

    .piece-grid {
      display: grid;
      background: var(--piece-grid-border);
      border: 1px solid var(--piece-grid-border);
      pointer-events: none;
    }

    .piece-cell {
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--piece-label-color);
      font-weight: bold;
      box-shadow: var(--piece-cell-inset-shadow);
      border-radius: 2px;
      box-sizing: border-box;
    }

    .piece-cell.has-value {
      background: var(--piece-color);
    }

    .controls {
      display: flex;
      gap: 2px;
    }

    button {
      font-size: 9px;
      padding: 1px 3px;
      cursor: pointer;
      background: var(--piece-btn-bg);
      color: var(--piece-btn-color);
      border: 1px solid var(--piece-btn-border);
      border-radius: var(--radius-sm);
    }

    .hover-preview {
      position: fixed;
      z-index: 1000;
      background: var(--hover-preview-bg);
      border: 2px solid var(--hover-preview-border);
      border-radius: 8px;
      padding: 5px;
      box-shadow: var(--hover-preview-shadow);
      pointer-events: none;
      display: grid;
      gap: 1px;
    }

    .hover-cell {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.2rem;
      font-weight: bold;
      background: transparent;
      box-shadow: var(--piece-cell-inset-shadow);
      border-radius: 2px;
    }

    .hover-cell.has-value {
      background: var(--piece-color);
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

    .tray-empty {
      color: var(--text-secondary);
      font-weight: bold;
      align-self: center;
    }
  `;

  constructor() {
    super();
    this.availableHeight = 540;
    this.availableWidth = 160;
    this._hoveredPieceId = null;
    this._hoverPos = { x: 0, y: 0 };
    this._animatingPieceId = null;
    this._animationType = '';
    this._prevPieces = null;
  }

  updated(changedProperties) {
    if (changedProperties.has('pieces') && this._prevPieces) {
      for (const piece of this.pieces) {
        const prev = this._prevPieces.find(p => p.id === piece.id);
        if (prev && JSON.stringify(piece.cells) !== JSON.stringify(prev.cells)) {
          this._animatingPieceId = piece.id;
          if (piece.rotation !== prev.rotation) {
            this._animationType = piece.rotation > prev.rotation || (piece.rotation === 0 && prev.rotation === 270) ? 'rotate-cw' : 'rotate-ccw';
          } else if (piece.mirrored !== prev.mirrored) {
            this._animationType = 'mirror';
          } else {
            this._animationType = 'rotate-cw';
          }

          setTimeout(() => {
            if (this._animatingPieceId === piece.id) {
              this._animatingPieceId = null;
              this._animationType = '';
              this.requestUpdate();
            }
          }, 200);
          break;
        }
      }
    }
    this._prevPieces = this.pieces ? JSON.parse(JSON.stringify(this.pieces)) : null;
  }

  getHitPieceId(clientX, clientY) {
    const previews = this.shadowRoot.querySelectorAll('.piece-container');
    for (const preview of previews) {
      const rect = preview.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right &&
          clientY >= rect.top  && clientY <= rect.bottom) {
        return parseInt(preview.dataset.pieceId);
      }
    }
    return null;
  }

  _onMouseEnter(e, pieceId) {
    this._hoveredPieceId = pieceId;
    this._updateHoverPos(e);
  }

  _onMouseMove(e) {
    if (this._hoveredPieceId !== null) {
      this._updateHoverPos(e);
    }
  }

  _onMouseLeave() {
    this._hoveredPieceId = null;
  }

  _updateHoverPos(e) {
    const x = e.clientX + 20;
    const y = e.clientY - 20;
    this._hoverPos = { x, y };
  }

  _onPieceClick(id) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'RECON/SELECT_PIECE', payload: { pieceId: id } },
      bubbles: true,
      composed: true
    }));
  }

  _onRotate(e, id, dir) {
    // e.stopPropagation();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'RECON/ROTATE_PIECE', payload: { pieceId: id, direction: dir } },
      bubbles: true,
      composed: true
    }));
  }
  
  _onMirror(e, id) {
    // e.stopPropagation();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'RECON/MIRROR_PIECE', payload: { pieceId: id } },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const unplacedPieces = this.pieces?.filter(p => p.placedAt === null) || [];
    if (unplacedPieces.length === 0) return html`<div class="tray-empty">All placed!</div>`;

    const hoveredPiece = this.pieces?.find(p => p.id === this._hoveredPieceId);

    const GAP = 6;
    const PADDING = 8;

    const findOptimalCellSize = (pieces, availW, availH) => {
      const PIECE_PADDING = 12;
      const CONTROLS_HEIGHT = 25;
      const NO_CONTROLS_HEIGHT = 12;
      const maxCellSize = 40;
      const minCellSize = 8;
      let best = minCellSize;
      
      const usableW = availW - PADDING * 2;
      const usableH = availH - PADDING * 2;

      for (let size = maxCellSize; size >= minCellSize; size--) {
        let x = 0, y = 0, rowHeight = 0;
        let fits = true;
        for (const piece of pieces) {
          const box = getBoundingBox(piece.cells);
          const hasControls = this.reconConstraints?.canRotate || this.reconConstraints?.canMirror;
          const pw = box.cols * size + PIECE_PADDING + GAP;
          const ph = box.rows * size + (hasControls ? CONTROLS_HEIGHT : NO_CONTROLS_HEIGHT) + GAP;
          
          if (x + pw > usableW + GAP) {
            x = 0;
            y += rowHeight;
            rowHeight = 0;
          }
          if (y + ph > usableH + GAP) {
            fits = false;
            break;
          }
          x += pw;
          rowHeight = Math.max(rowHeight, ph);
        }
        if (fits) { best = size; break; }
      }
      return best;
    };

    const cellSize = findOptimalCellSize(unplacedPieces, this.availableWidth, this.availableHeight);

    return html`
      ${unplacedPieces.map(p => {
        const box = getBoundingBox(p.cells);
        const grid = Array.from({ length: box.rows }, () => Array(box.cols).fill(null));
        p.cells.forEach(c => {
          grid[c.localRow][c.localCol] = c.value;
        });

        const animClass = this._animatingPieceId === p.id ? 
          (this._animationType === 'rotate-cw' ? 'animating-cw' : 
           this._animationType === 'rotate-ccw' ? 'animating-ccw' : 'animating-mirror') : '';

        return html`
          <div class="piece-container ${this.selectedPieceId === p.id ? 'is-selected' : ''}" 
               data-piece-id="${p.id}"
               @click="${() => this._onPieceClick(p.id)}"
               @mouseenter="${(e) => this._onMouseEnter(e, p.id)}"
               @mousemove="${this._onMouseMove}"
               @mouseleave="${this._onMouseLeave}">
            <div class="piece-grid ${animClass}" 
                 style="grid-template-columns: repeat(${box.cols}, 1fr); --piece-color: ${p.color}; gap: 1px;">
              ${grid.flat().map(val => html`
                <div class="piece-cell ${val !== null ? 'has-value' : ''}" 
                     style="width: ${cellSize}px; height: ${cellSize}px; font-size: ${Math.max(7, Math.floor(cellSize * 0.45))}px;">
                  ${val || ''}
                </div>
              `)}
            </div>
            <div class="controls">
              ${this.reconConstraints?.canRotate ? html`
                <button @click="${(e) => this._onRotate(e, p.id, 'CW')}">R</button>
              ` : ''}
              ${this.reconConstraints?.canMirror ? html`
                <button @click="${(e) => this._onMirror(e, p.id)}">M</button>
              ` : ''}
            </div>
          </div>
        `;
      })}

      ${hoveredPiece ? html`
        <div class="hover-preview" style="
          left: ${this._hoverPos.x}px;
          top: ${this._hoverPos.y}px;
          grid-template-columns: repeat(${getBoundingBox(hoveredPiece.cells).cols}, 1fr);
          --piece-color: ${hoveredPiece.color};
        ">
          ${(() => {
            const box = getBoundingBox(hoveredPiece.cells);
            const grid = Array.from({ length: box.rows }, () => Array(box.cols).fill(null));
            hoveredPiece.cells.forEach(c => {
              grid[c.localRow][c.localCol] = c.value;
            });
            return grid.flat().map(val => html`
              <div class="hover-cell ${val !== null ? 'has-value' : ''}">
                ${val || ''}
              </div>
            `);
          })()}
        </div>
      ` : ''}
    `;
  }
}

customElements.define('piece-tray', PieceTray);
