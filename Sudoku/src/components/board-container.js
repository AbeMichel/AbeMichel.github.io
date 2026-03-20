import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './sudoku-board.js';
import './sudoku-recon.js';
import './competitive-board.js';
import './piece-tray.js';
import { hasOverlap, getCellsAtPosition } from '../utils/pieceGeometry.js';

export class BoardContainer extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    modifiers: { type: Object },
    settingsState: { type: Object },
    historyState: { type: Object },
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
    const board = this.shadowRoot.querySelector('sudoku-board');
    board?.focus();
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

    if (this.gameState.mode === 'STANDARD' && this.multiplayerState?.mpMode === 'COMPETITIVE') {
      return html`
        <competitive-board
          .gameState="${this.gameState}"
          .uiState="${this.uiState}"
          .modifiers="${this.modifiers}"
          .settingsState="${this.settingsState}"
          .multiplayerState="${this.multiplayerState}"
        ></competitive-board>
      `;
    }

    if (this.gameState.mode === 'RECONSTRUCTION') {
      return html`
        <div class="recon-layout">
          <div class="board-area">
            <sudoku-recon
              .gameState="${this.gameState}"
              .uiState="${this.uiState}"
              .modifiers="${this.modifiers}"
              .settingsState="${this.settingsState}"
              .multiplayerState="${this.multiplayerState}"
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

    const totalSeconds = Math.floor((this.gameState?.timer || 0) / 1000);
    const timer = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
    const mistakes = this.gameState?.mistakes ?? 0;
    const inputMode = this.uiState?.inputMode || 'VALUE';
    const selectedId = this.uiState?.selectedId;
    const peerId = this.multiplayerState?.peerId || null;
    const canUndo = (this.historyState?.past?.length ?? 0) > 0;
    const canRedo = (this.historyState?.future?.length ?? 0) > 0;

    const dispatch = (detail) => this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));

    const hudBtn = (icon, type, enabled = true) => html`
      <button style="
        width:32px;height:32px;border-radius:var(--radius-circle);
        border:none;cursor:${enabled ? 'pointer' : 'default'};
        background:var(--hud-btn-bg);
        color:var(--text-primary);font-size:13px;
        box-shadow:var(--hud-btn-shadow);
        backdrop-filter:blur(4px);
        transition:all 0.15s;
        display:flex;align-items:center;justify-content:center;
        opacity:${enabled ? 1 : 0.35};
      " ?disabled="${!enabled}" @mousedown="${e => e.preventDefault()}" @click="${() => enabled && dispatch({ type })}">
        ${icon}
      </button>`;

    const modeChip = (label, mode) => {
      const active = inputMode === mode;
      return html`
        <button style="
          flex:1;height:30px;border-radius:var(--radius-chip);
          border:none;cursor:pointer;
          font-family:var(--font-ui);font-size:11px;letter-spacing:0.05em;font-weight:500;
          color:${active ? 'var(--chip-active-color)' : 'var(--text-primary)'};
          background:${active ? 'var(--chip-active-bg)' : 'var(--chip-bg)'};
          box-shadow:${active ? 'var(--chip-shadow-active)' : 'var(--chip-shadow)'};
          transition:all 0.12s;
        " @mousedown="${e => e.preventDefault()}" @click="${() => dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode } })}">
          ${label}
        </button>`;
    };

    const numChip = (n) => html`
      <button style="
        width:44px;height:44px;border-radius:var(--radius-chip);
        border:none;cursor:pointer;
        font-family:var(--font-numbers);font-weight:700;font-size:20px;
        color:var(--chip-color);
        background:var(--chip-bg);
        box-shadow:var(--chip-shadow);
        text-shadow:0 1px 0 rgba(255,255,255,0.18),0 -1px 1px rgba(0,0,0,0.2);
        transition:all 0.12s;
      " @mousedown="${e => e.preventDefault()}" @click="${() => {
        const effectiveMode = this.uiState?.inputMode || 'VALUE';
        const actionType = effectiveMode === 'CANDIDATE' ? 'BOARD/SET_CANDIDATE' : 'BOARD/SET_VALUE';
        const payload = { id: selectedId, value: n, peerId };
        if (actionType === 'BOARD/SET_CANDIDATE') payload.autoCandidates = this.settingsState?.autoCandidates ?? false;
        dispatch({ type: actionType, payload });
      }}">
        ${n}
      </button>`;

    const actionChip = (label, type, payload = {}) => html`
      <button style="
        height:36px;padding:0 14px;border-radius:var(--radius-chip);
        border:none;cursor:pointer;white-space:nowrap;
        font-family:var(--font-display);font-size:12px;font-style:italic;
        color:var(--chip-color);
        background:var(--chip-bg);
        box-shadow:var(--chip-shadow);
        transition:all 0.12s;
      " @mousedown="${e => e.preventDefault()}" @click="${() => dispatch({ type, payload })}">
        ${label}
      </button>`;

    return html`
      <div style="display:flex;flex-direction:column;align-items:center;width:100%;padding:0 1rem;box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:center;width:100%;margin-bottom:20px;position:relative;">
          <button @mousedown="${e => e.preventDefault()}" @click="${() => dispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } })}" style="
            position:absolute;left:0;
            font-family:var(--font-display);font-style:italic;font-size:14px;
            color:var(--text-secondary);background:none;border:none;
            cursor:pointer;transition:color 0.2s;padding:0;
          " onmouseover="this.style.color='var(--text-primary)'" onmouseout="this.style.color='var(--text-secondary)'">← Menu</button>
          <div style="display:flex;flex-direction:column;align-items:center;">
            <div style="font-family:var(--font-display);font-size:28px;font-weight:500;color:var(--text-primary);text-shadow:0 1px 3px rgba(255,255,255,0.3);">Sudokus</div>
            <div style="font-family:var(--font-display);font-style:italic;font-size:14px;color:var(--text-accent);margin-top:-2px;padding-left:3px;">by Abe</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:40px;margin-bottom:16px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;">
            ${this.settingsState?.showTimer !== false ? html`
              <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);font-family:var(--font-ui);">Time</div>
              <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${timer}</div>
            ` : ''}
          </div>
          <div style="display:flex;gap:8px;">
            ${hudBtn('↩', 'HISTORY/UNDO', canUndo && !this.uiState?.viewingSolution)}
            ${hudBtn('↪', 'HISTORY/REDO', canRedo && !this.uiState?.viewingSolution)}
            ${hudBtn('⚙', 'UI/OPEN_SETTINGS')}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;">
            ${this.settingsState?.showMistakes !== false ? html`
              <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);font-family:var(--font-ui);">Mistakes</div>
              <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${mistakes}</div>
            ` : ''}
          </div>
        </div>

        <div style="display:flex;align-items:flex-start;gap:20px;">
          <sudoku-board
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiers}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
            .viewingSolution="${this.uiState?.viewingSolution ?? false}"
          ></sudoku-board>

          <div style="
            display:flex;flex-direction:column;gap:10px;padding-top:8px;
            opacity:${this.uiState?.viewingSolution ? 0.3 : 1};
            pointer-events:${this.uiState?.viewingSolution ? 'none' : 'auto'};
            transition:opacity 0.3s ease;
          ">
            <div style="display:flex;gap:6px;">
              ${modeChip('Value', 'VALUE')}
              ${modeChip('Candidate', 'CANDIDATE')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${[1,2,3,4,5,6,7,8,9].map(n => numChip(n))}
            </div>
            <div style="display:flex;flex-direction:column;gap:7px;">
              <button style="
                height:36px;padding:0 14px;border-radius:var(--radius-chip);
                border:none;cursor:pointer;white-space:nowrap;
                font-family:var(--font-display);font-size:12px;font-style:italic;
                color:var(--chip-color);
                background:var(--chip-bg);
                box-shadow:var(--chip-shadow);
                transition:all 0.12s;
              " @mousedown="${e => e.preventDefault()}" @click="${() => {
                const cell = this.gameState?.cells?.[selectedId];
                if (!cell || cell.fixed) return;
                if (cell.v !== 0) {
                  dispatch({ type: 'BOARD/CLEAR_CELL', payload: { id: selectedId, peerId } });
                } else if (cell.c?.length > 0) {
                  dispatch({ type: 'BOARD/CLEAR_CANDIDATES', payload: { id: selectedId } });
                }
              }}">Erase</button>
              ${actionChip('Hint', 'GAME/HINT', {})}
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding:6px 2px;">
              <span style="font-family:var(--font-display);font-style:italic;font-size:12px;color:var(--text-secondary);">Auto candidates</span>
              <div @mousedown="${e => e.preventDefault()}" @click="${() => {
                dispatch({ type: 'SETTINGS/SET', payload: { key: 'autoCandidates', value: !this.settingsState?.autoCandidates } });
                setTimeout(() => this.shadowRoot.querySelector('sudoku-board')?.focus(), 0);
              }}" style="
                width:36px;height:20px;border-radius:10px;
                background:${this.settingsState?.autoCandidates ? 'rgba(208,104,64,0.6)' : 'rgba(180,130,90,0.25)'};
                border:1px solid ${this.settingsState?.autoCandidates ? 'rgba(190,90,55,0.5)' : 'rgba(180,130,90,0.3)'};
                position:relative;cursor:pointer;transition:background 0.2s;flex-shrink:0;
              ">
                <div style="
                  width:14px;height:14px;border-radius:50%;background:#fdf5ee;
                  position:absolute;top:2px;left:2px;
                  transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);
                  transform:${this.settingsState?.autoCandidates ? 'translateX(16px)' : 'translateX(0)'};
                  pointer-events:none;
                "></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('board-container', BoardContainer);
