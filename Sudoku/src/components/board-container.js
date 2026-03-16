import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './sudoku-board.js';
import './sudoku-recon.js';
import './piece-tray.js';
import { hasOverlap, getCellsAtPosition } from '../utils/pieceGeometry.js';

export class BoardContainer extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    modifiers: { type: Object },
    settingsState: { type: Object },
    _boardHeight: { type: Number },
    _trayWidth: { type: Number }
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      outline: none;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    .recon-layout {
      display: grid;
      grid-template-columns: min(90vw, 540px) 1fr;
      grid-template-areas: "board tray";
      gap: 1rem;
      align-items: start;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      box-sizing: border-box;
      padding: 0 1rem;
    }

    .board-area {
      grid-area: board;
    }

    .tray-area {
      grid-area: tray;
      align-self: stretch;
      display: flex;
      flex-direction: column;
      min-width: 0; /* prevents grid blowout */
    }

    @media (max-width: 700px) {
      .recon-layout {
        grid-template-columns: 1fr;
        grid-template-areas:
          "board"
          "tray";
        padding: 0 0.5rem;
      }
    }
  `;

  constructor() {
    super();
    this.tabIndex = 0;
    this._boardHeight = 540;
    this._trayWidth = 160;
  }

  connectedCallback() {
    super.connectedCallback();
    this._boundPointerDown = this._onPointerDown.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
    this._boundKeyDown = this._onKeyDown.bind(this);
    this.addEventListener('pointerdown', this._boundPointerDown);
    this.addEventListener('pointermove', this._boundPointerMove);
    this.addEventListener('pointerup', this._boundPointerUp);
    this.addEventListener('keydown', this._boundKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this.removeEventListener('pointerdown', this._boundPointerDown);
    this.removeEventListener('pointermove', this._boundPointerMove);
    this.removeEventListener('pointerup', this._boundPointerUp);
    this.removeEventListener('keydown', this._boundKeyDown);
  }

  firstUpdated() {
    this._observeBoard();
  }

  updated(changedProperties) {
    if (changedProperties.has('gameState')) {
      const oldGame = changedProperties.get('gameState');
      if (this.gameState?.mode !== oldGame?.mode) {
        this.reinitialize();
        setTimeout(() => this._observeBoard(), 0);
      }
    }
  }

  _onPointerDown(e) {
    const path = e.composedPath();
    if (path.some(el => el.tagName === 'BUTTON')) return;
    if (this.gameState?.mode !== 'RECONSTRUCTION') return;
    const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
    if (!reconBoard) return;

    // Check if pointer is over a piece in the tray
    const tray = this.shadowRoot.querySelector('piece-tray');
    const trayPieceId = tray?.getHitPieceId?.(e.clientX, e.clientY);
    if (trayPieceId != null) {
      this.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('dispatch-action', {
        detail: { type: 'RECON/PICK_UP_PIECE', payload: { pieceId: trayPieceId } },
        bubbles: true, composed: true
      }));
      reconBoard.beginDrag(trayPieceId, e.clientX, e.clientY);
      return;
    }

    // Check if pointer is over a placed piece on the board
    const boardRect = reconBoard.getBoundingClientRect();
    if (e.clientX < boardRect.left || e.clientX > boardRect.right ||
        e.clientY < boardRect.top  || e.clientY > boardRect.bottom) return;

    const boardPieceId = reconBoard.getHitPieceId?.(e.clientX, e.clientY);
    if (boardPieceId != null) {
      this.setPointerCapture(e.pointerId);
      this.dispatchEvent(new CustomEvent('dispatch-action', {
        detail: { type: 'RECON/PICK_UP_PIECE', payload: { pieceId: boardPieceId } },
        bubbles: true, composed: true
      }));
      reconBoard.beginDrag(boardPieceId, e.clientX, e.clientY);
    }
  }

  _onPointerMove(e) {
    if (this.gameState?.mode !== 'RECONSTRUCTION') return;
    const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
    reconBoard?.updateDrag?.(e.clientX, e.clientY);
  }

  _onPointerUp(e) {
    const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
    if (this.gameState?.mode !== 'RECONSTRUCTION') return;
    if (!reconBoard?._dragState) return;

    const { pieceId, boardRow, boardCol } = reconBoard._dragState;
    const boardRect = reconBoard.getBoundingClientRect();
    const isOverBoard = e.clientX >= boardRect.left && e.clientX <= boardRect.right &&
                        e.clientY >= boardRect.top  && e.clientY <= boardRect.bottom;
    if (isOverBoard && boardRow >= 0 && boardRow < 9 && boardCol >= 0 && boardCol < 9) {
      const piece = this.gameState.pieces.find(p => p.id === pieceId);
      if (hasOverlap(piece, boardRow, boardCol, this.gameState.pieces)) {
        this.dispatchEvent(new CustomEvent('dispatch-action', {
          detail: { type: 'RECON/RETURN_PIECE', payload: { pieceId } },
          bubbles: true, composed: true
        }));
      } else {
        this.dispatchEvent(new CustomEvent('dispatch-action', {
          detail: { type: 'RECON/PLACE_PIECE', payload: { pieceId, boardRow, boardCol } },
          bubbles: true, composed: true
        }));
      }
    } else {
      this.dispatchEvent(new CustomEvent('dispatch-action', {
        detail: { type: 'RECON/RETURN_TO_TRAY', payload: { pieceId } },
        bubbles: true, composed: true
      }));
    }

    reconBoard.endDrag();
    this.releasePointerCapture(e.pointerId);
  }

  _onKeyDown(e) {
    if (this.gameState?.mode !== 'RECONSTRUCTION') return;
    const selectedPieceId = this.uiState?.selectedPieceId;
    const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
    const heldPieceId = reconBoard?._dragState?.pieceId;
    const targetPieceId = heldPieceId ?? selectedPieceId;
    if (targetPieceId == null) return;

    if (e.key.toLowerCase() === 'r') {
      if (!this.gameState?.reconConstraints?.canRotate) return;
      e.preventDefault();
      const direction = e.shiftKey ? 'CCW' : 'CW';
      this.dispatchEvent(new CustomEvent('dispatch-action', {
        detail: { type: 'RECON/ROTATE_PIECE', payload: { pieceId: targetPieceId, direction } },
        bubbles: true,
        composed: true
      }));
      // Trigger drag ghost animation
      const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
      reconBoard?._triggerDragAnim(direction === 'CW' ? 'animating-cw' : 'animating-ccw');
    } else if (e.key.toLowerCase() === 'm') {
      if (!this.gameState?.reconConstraints?.canMirror) return;
      e.preventDefault();
      this.dispatchEvent(new CustomEvent('dispatch-action', {
        detail: { type: 'RECON/MIRROR_PIECE', payload: { pieceId: targetPieceId } },
        bubbles: true,
        composed: true
      }));
      const reconBoard = this.shadowRoot.querySelector('sudoku-recon');
      reconBoard?._triggerDragAnim('animating-mirror');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (heldPieceId != null) {
        this.dispatchEvent(new CustomEvent('dispatch-action', {
          detail: { type: 'RECON/RETURN_TO_TRAY', payload: { pieceId: heldPieceId } },
          bubbles: true,
          composed: true
        }));
      } else {
        this.dispatchEvent(new CustomEvent('dispatch-action', {
          detail: { type: 'RECON/SELECT_PIECE', payload: { pieceId: null } },
          bubbles: true,
          composed: true
        }));
      }
    }
  }

  _observeBoard() {
    if (this._resizeObserver) this._resizeObserver.disconnect();
    this._resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === this._boardEl) {
          this._boardHeight = Math.round(entry.contentRect.height);
        } else if (entry.target === this._trayEl) {
          this._trayWidth = Math.round(entry.contentRect.width);
        }
        this.requestUpdate();
      }
    });
    this._boardEl = this.shadowRoot.querySelector('sudoku-recon, sudoku-board');
    this._trayEl = this.shadowRoot.querySelector('.tray-area');
    if (this._boardEl) {
      this._resizeObserver.observe(this._boardEl);
      this._boardHeight = Math.round(this._boardEl.getBoundingClientRect().height);
    }
    if (this._trayEl) {
      this._resizeObserver.observe(this._trayEl);
      this._trayWidth = Math.round(this._trayEl.getBoundingClientRect().width);
    }
  }

  reinitialize() {
    const board = this.shadowRoot.querySelector('sudoku-recon, sudoku-board');
    if (board) board.reinitialize();
  }

  render() {
    if (!this.gameState) return html`<div>Loading...</div>`;

    if (this.gameState.mode === 'RECONSTRUCTION') {
      return html`
        <div class="recon-layout">
          <div class="board-area">
            <sudoku-recon
              .gameState="${this.gameState}"
              .uiState="${this.uiState}"
              .modifiers="${this.modifiers}"
              .settingsState="${this.settingsState}"
            ></sudoku-recon>
          </div>
          <div class="tray-area">
            <piece-tray
              .pieces="${this.gameState.pieces}"
              .selectedPieceId="${this.uiState.selectedPieceId}"
              .reconConstraints="${this.gameState.reconConstraints}"
              .availableHeight="${this._boardHeight}"
              .availableWidth="${this._trayWidth || 160}"
            ></piece-tray>
          </div>
        </div>
      `;
    }

    return html`
      <sudoku-board
        .gameState="${this.gameState}"
        .uiState="${this.uiState}"
        .modifiers="${this.modifiers}"
        .settingsState="${this.settingsState}"
      ></sudoku-board>
    `;
  }
}

customElements.define('board-container', BoardContainer);
