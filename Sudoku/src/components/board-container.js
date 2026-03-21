import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { unsafeHTML } from 'https://esm.sh/lit@3/directives/unsafe-html.js';

const ICON_UNDO = unsafeHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 9v5h5m11 2c-.497-4.5-3.367-8-8-8c-2.73 0-5.929 2.268-7.294 5.5"/></svg>`);
const ICON_REDO = unsafeHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 9v5h-5M4 16c.497-4.5 3.367-8 8-8c2.73 0 5.929 2.268 7.294 5.5"/></svg>`);
const ICON_SETTINGS = unsafeHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M14.279 2.152C13.909 2 13.439 2 12.5 2s-1.408 0-1.779.152a2 2 0 0 0-1.09 1.083c-.094.223-.13.484-.145.863a1.62 1.62 0 0 1-.796 1.353a1.64 1.64 0 0 1-1.579.008c-.338-.178-.583-.276-.825-.308a2.03 2.03 0 0 0-1.49.396c-.318.242-.553.646-1.022 1.453c-.47.807-.704 1.21-.757 1.605c-.07.526.074 1.058.4 1.479c.148.192.357.353.68.555c.477.297.783.803.783 1.361s-.306 1.064-.782 1.36c-.324.203-.533.364-.682.556a2 2 0 0 0-.399 1.479c.053.394.287.798.757 1.605s.704 1.21 1.022 1.453c.424.323.96.465 1.49.396c.242-.032.487-.13.825-.308a1.64 1.64 0 0 1 1.58.008c.486.28.774.795.795 1.353c.015.38.051.64.145.863c.204.49.596.88 1.09 1.083c.37.152.84.152 1.779.152s1.409 0 1.779-.152a2 2 0 0 0 1.09-1.083c.094-.223.13-.483.145-.863c.02-.558.309-1.074.796-1.353a1.64 1.64 0 0 1 1.579-.008c.338.178.583.276.825.308c.53.07 1.066-.073 1.49-.396c.318-.242.553-.646 1.022-1.453c.47-.807.704-1.21.757-1.605a2 2 0 0 0-.4-1.479c-.148-.192-.357-.353-.68-.555c-.477-.297-.783-.803-.783-1.361s.306-1.064.782-1.36c.324-.203.533-.364.682-.556a2 2 0 0 0 .399-1.479c-.053-.394-.287-.798-.757-1.605s-.704-1.21-1.022-1.453a2.03 2.03 0 0 0-1.49-.396c-.242.032-.487.13-.825.308a1.64 1.64 0 0 1-1.58-.008a1.62 1.62 0 0 1-.795-1.353c-.015-.38-.051-.64-.145-.863a2 2 0 0 0-1.09-1.083M12.5 15c1.67 0 3.023-1.343 3.023-3S14.169 9 12.5 9s-3.023 1.343-3.023 3s1.354 3 3.023 3" clip-rule="evenodd"/></svg>`);
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

    .recon-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .recon-hud {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      box-sizing: border-box;
    }

    .hud-btn {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      transition: color 0.2s;
      padding: 0;
    }

    .hud-btn:hover {
      color: var(--text-primary);
    }

    .timer-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
    }

    .mistake-counter {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      min-width: 52px;
      text-align: center;
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

    .game-layout {
      display: flex;
      align-items: flex-start;
      gap: 20px;
    }

    .desktop-controls {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 8px;
    }

    .mobile-controls {
      display: none;
      flex-direction: column;
      gap: 12px;
      width: 100%;
    }

    .control-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
    }

    .mode-chips {
      display: flex;
      gap: 6px;
      flex: 1;
    }

    .number-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 7px;
      width: 100%;
    }

    @media (max-width: 700px) {
      .game-layout {
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 100%;
      }

      .desktop-controls {
        display: none;
      }

      .mobile-controls {
        display: flex;
        width: min(90vw, 540px);
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
      const totalSeconds = Math.floor((this.gameState?.timer || 0) / 1000);
      const timer = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
      const mistakes = this.gameState?.mistakes ?? 0;
      const canUndo = (this.historyState?.past?.length ?? 0) > 0;
      const canRedo = (this.historyState?.future?.length ?? 0) > 0;
      const compDispatch = (detail) => this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
      const compHudBtn = (icon, type, label, enabled = true) => html`
        <button aria-label="${label}" style="
          width:36px;height:36px;border-radius:var(--radius-circle);
          border:none;cursor:${enabled ? 'pointer' : 'default'};
          background:var(--hud-btn-bg);
          color:var(--text-primary);font-size:16px;
          box-shadow:var(--hud-btn-shadow);
          backdrop-filter:blur(4px);
          transition:all 0.15s;
          display:flex;align-items:center;justify-content:center;
          opacity:${enabled ? 1 : 0.35};
        " ?disabled="${!enabled}" @mousedown="${e => e.preventDefault()}" @click="${() => enabled && compDispatch({ type })}">
          ${icon}
        </button>`;

      return html`
        <div style="display:flex;flex-direction:column;align-items:center;width:100%;padding:0 1rem;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:center;width:100%;margin-bottom:20px;position:relative;">
            <button @mousedown="${e => e.preventDefault()}" @click="${() => compDispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } })}" style="
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
              ${compHudBtn(ICON_UNDO, 'HISTORY/UNDO', 'Undo', canUndo)}
              ${compHudBtn(ICON_REDO, 'HISTORY/REDO', 'Redo', canRedo)}
              ${compHudBtn(ICON_SETTINGS, 'UI/OPEN_SETTINGS', 'Settings')}
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;">
              ${this.settingsState?.showMistakes !== false ? html`
                <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);font-family:var(--font-ui);">Mistakes</div>
                <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${mistakes}</div>
              ` : ''}
            </div>
          </div>

          <competitive-board
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiers}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
          ></competitive-board>
        </div>
      `;
    }

    if (this.gameState.mode === 'RECONSTRUCTION') {
      const totalSeconds = Math.floor((this.gameState?.timer || 0) / 1000);
      const reconTimer = `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
      const moveCount = this.gameState.moveCount ?? 0;
      const canUndo = (this.historyState?.past?.length ?? 0) > 0;
      const canRedo = (this.historyState?.future?.length ?? 0) > 0;
      const reconDispatch = (detail) => this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
      const reconHudBtn = (icon, type, label, enabled = true) => html`
        <button aria-label="${label}" style="
          width:36px;height:36px;border-radius:var(--radius-circle);
          border:none;cursor:${enabled ? 'pointer' : 'default'};
          background:var(--hud-btn-bg);
          color:var(--text-primary);font-size:16px;
          box-shadow:var(--hud-btn-shadow);
          backdrop-filter:blur(4px);
          transition:all 0.15s;
          display:flex;align-items:center;justify-content:center;
          opacity:${enabled ? 1 : 0.35};
        " ?disabled="${!enabled}" @mousedown="${e => e.preventDefault()}" @click="${() => enabled && reconDispatch({ type })}">
          ${icon}
        </button>`;

      return html`
        <div style="display:flex;flex-direction:column;align-items:center;width:100%;padding:0 1rem;box-sizing:border-box;">
          <div style="display:flex;align-items:center;justify-content:center;width:100%;margin-bottom:20px;position:relative;">
            <button @mousedown="${e => e.preventDefault()}" @click="${() => {
              if (this.gameState?.status === 'PLAYING') reconDispatch({ type: 'GAME/ABANDON' });
              reconDispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } });
            }}" style="
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
                <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${reconTimer}</div>
              ` : ''}
            </div>
            <div style="display:flex;gap:8px;">
              ${reconHudBtn(ICON_UNDO, 'HISTORY/UNDO', 'Undo', canUndo)}
              ${reconHudBtn(ICON_REDO, 'HISTORY/REDO', 'Redo', canRedo)}
              ${reconHudBtn(ICON_SETTINGS, 'UI/OPEN_SETTINGS', 'Settings')}
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;">
              <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);font-family:var(--font-ui);">Moves</div>
              <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${moveCount}</div>
            </div>
          </div>

          <div class="recon-layout">
            <div class="board-area" style="display:flex;flex-direction:column;gap:12px;">
              <sudoku-recon
                .gameState="${this.gameState}"
                .uiState="${this.uiState}"
                .modifiers="${this.modifiers}"
                .settingsState="${this.settingsState}"
                .multiplayerState="${this.multiplayerState}"
              ></sudoku-recon>

              <div style="display:flex;gap:7px;justify-content:center;">
                ${[1,2,3,4,5,6,7,8,9].map(n => html`
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
                    const selectedId = this.uiState?.selectedId;
                    if (selectedId == null) return;
                    reconDispatch({ type: 'BOARD/SET_CANDIDATE', payload: { id: selectedId, value: n, autoCandidates: this.settingsState?.autoCandidates ?? false } });
                  }}">${n}</button>
                `)}
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;padding:2px 4px;">
                <span style="font-family:var(--font-display);font-style:italic;font-size:12px;color:var(--text-secondary);">Auto candidates</span>
                <div @mousedown="${e => e.preventDefault()}" @click="${() => {
                  reconDispatch({ type: 'SETTINGS/SET', payload: { key: 'autoCandidates', value: !this.settingsState?.autoCandidates } });
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

    const hudBtn = (icon, type, label, enabled = true) => html`
      <button aria-label="${label}" style="
        width:36px;height:36px;border-radius:var(--radius-circle);
        border:none;cursor:${enabled ? 'pointer' : 'default'};
        background:var(--hud-btn-bg);
        color:var(--text-primary);font-size:16px;
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

    const numChip = (n, isMobile = false) => html`
      <button style="
        width:${isMobile ? '100%' : '44px'};aspect-ratio:1;border-radius:var(--radius-chip);
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
        font-family:var(--font-display);font-size:12px;
        color:var(--chip-color);
        background:var(--chip-bg);
        box-shadow:var(--chip-shadow);
        transition:all 0.12s;
      " @mousedown="${e => e.preventDefault()}" @click="${() => dispatch({ type, payload })}">
        ${label}
      </button>`;

    const autoToggle = () => html`
      <div style="display:flex;align-items:center;gap:12px;padding:0 4px;">
        <span style="font-family:var(--font-display);font-style:italic;font-size:12px;color:var(--text-secondary);white-space:nowrap;">Auto candidates</span>
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
      </div>`;

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
            ${hudBtn(ICON_UNDO, 'HISTORY/UNDO', 'Undo', canUndo && !this.uiState?.viewingSolution)}
            ${hudBtn(ICON_REDO, 'HISTORY/REDO', 'Redo', canRedo && !this.uiState?.viewingSolution)}
            ${hudBtn(ICON_SETTINGS, 'UI/OPEN_SETTINGS', 'Settings')}
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;">
            ${this.settingsState?.showMistakes !== false ? html`
              <div style="font-size:9px;letter-spacing:0.14em;text-transform:uppercase;color:var(--text-secondary);font-family:var(--font-ui);">Mistakes</div>
              <div style="font-family:var(--font-display);font-size:24px;color:var(--text-primary);">${mistakes}</div>
            ` : ''}
          </div>
        </div>

        <div class="game-layout">
          <sudoku-board
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiers}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
            .viewingSolution="${this.uiState?.viewingSolution ?? false}"
          ></sudoku-board>

          <!-- Desktop controls -->
          <div class="desktop-controls" style="
            opacity:${this.uiState?.viewingSolution ? 0.3 : 1};
            pointer-events:${this.uiState?.viewingSolution ? 'none' : 'auto'};
            transition:opacity 0.3s ease;
          ">
            <div style="display:flex;gap:6px;">
              ${modeChip('Value', 'VALUE')}
              ${modeChip('Candidate', 'CANDIDATE')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${[1,2,3,4,5,6,7,8,9].map(n => numChip(n, false))}
            </div>
            <div style="display:flex;flex-direction:column;gap:7px;">
              <button style="
                height:36px;padding:0 14px;border-radius:var(--radius-chip);
                border:none;cursor:pointer;white-space:nowrap;
                font-family:var(--font-display);font-size:12px;
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
              ${autoToggle()}
            </div>
          </div>

          <!-- Mobile controls -->
          <div class="mobile-controls" style="
            opacity:${this.uiState?.viewingSolution ? 0.3 : 1};
            pointer-events:${this.uiState?.viewingSolution ? 'none' : 'auto'};
            transition:opacity 0.3s ease;
          ">
            <div class="control-row">
              <div class="mode-chips">
                ${modeChip('Value', 'VALUE')}
                ${modeChip('Candidate', 'CANDIDATE')}
              </div>
            </div>
            <div class="number-row">
              ${[1,2,3,4,5].map(n => numChip(n, true))}
            </div>
            <div class="number-row">
              ${[6,7,8,9].map(n => numChip(n, true))}
              <button style="
                width:100%;aspect-ratio:1;border-radius:var(--radius-chip);
                border:none;cursor:pointer;
                font-family:var(--font-display);font-size:12px;
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
            </div>
            <div class="control-row" style="justify-content:center;gap:20px;">
              ${actionChip('Hint', 'GAME/HINT', {})}
              ${autoToggle()}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('board-container', BoardContainer);
