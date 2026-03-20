import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { repeat } from 'https://esm.sh/lit@3/directives/repeat.js';
import './sudoku-cell.js';
import { getRow, getCol, getHighlightedIds, getConflictIds, getRegionBorderClasses } from '../utils/boardGeometry.js';
import { getRegionColor } from '../config/regionColors.js';

export class SudokuBoard extends LitElement {
  static shadowRootOptions = { ...LitElement.shadowRootOptions };

  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    modifiers: { type: Object },
    settingsState: { type: Object },
    viewingSolution: { type: Boolean }
  };

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      width: min(90vw, 540px);
      height: min(90vw, 540px);
      margin: 0 auto;
      border: 1px solid var(--board-border);
      background: var(--board-bg);
      box-shadow: var(--board-shadow);
      border-radius: var(--radius-sm);
      box-sizing: border-box;
      outline: none;
    }

    .grid {
      display: contents; /* Grid logic is now on host */
      outline: none;
    }

    @keyframes living-swap {
      0%   { opacity: 0.5; transform: scale(0.97); }
      100% { opacity: 1;   transform: scale(1); }
    }
    :host(.living-flash) {
      animation: living-swap 0.35s ease-out forwards;
    }
  `;

  constructor() {
    super();
    this.tabIndex = 0;
    this._shiftHeld = false;
    this._preShiftMode = null;
    this._boundKeyDown = this.handleInput.bind(this);
    this._boundKeyUp = this._handleKeyUp.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', this._boundKeyDown);
    this.addEventListener('keyup', this._boundKeyUp);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('keydown', this._boundKeyDown);
    this.removeEventListener('keyup', this._boundKeyUp);
  }

  handleInput(e) {
    if (this.viewingSolution) return;

    if (e.key === 'Shift' && !this._shiftHeld) {
      this._shiftHeld = true;
      this._preShiftMode = this.uiState?.inputMode || 'VALUE';
      const opposite = this._preShiftMode === 'VALUE' ? 'CANDIDATE' : 'VALUE';
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: opposite } });
      return;
    }

    const selectedId = this.uiState?.selectedId;
    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (selectedId == null) {
        const cells = this.gameState?.cells || [];
        let startId = 0;
        for (let i = cells.length - 1; i >= 0; i--) {
          if (!cells[i].fixed && cells[i].v !== 0) {
            startId = cells[i].id;
            break;
          }
        }
        this._dispatch({ type: 'UI/SELECT_CELL', payload: { id: startId } });
        return;
      }
      const row = Math.floor(selectedId / 9);
      const col = selectedId % 9;
      let newId = selectedId;
      if (e.key === 'ArrowUp' && row > 0) newId = selectedId - 9;
      if (e.key === 'ArrowDown' && row < 8) newId = selectedId + 9;
      if (e.key === 'ArrowLeft' && col > 0) newId = selectedId - 1;
      if (e.key === 'ArrowRight' && col < 8) newId = selectedId + 1;
      this._dispatch({ type: 'UI/SELECT_CELL', payload: { id: newId } });
      return;
    }

    // Digit input
    if (/^Digit[1-9]$/.test(e.code)) {
      if (selectedId == null) return;
      const cell = this.gameState?.cells?.[selectedId];
      if (!cell || cell.fixed) return;
      const effectiveMode = this._shiftHeld
        ? (this._preShiftMode === 'VALUE' ? 'CANDIDATE' : 'VALUE')
        : (this.uiState?.inputMode || 'VALUE');
      const actionType = effectiveMode === 'CANDIDATE'
        ? 'BOARD/SET_CANDIDATE'
        : 'BOARD/SET_VALUE';
      const payload = {
        id: selectedId,
        value: parseInt(e.code.replace('Digit', '')),
        peerId: this.multiplayerState?.peerId || null
      };
      if (actionType === 'BOARD/SET_CANDIDATE') {
        payload.autoCandidates = this.settingsState?.autoCandidates ?? false;
      }
      this._dispatch({ type: actionType, payload });
      return;
    }

    // Clear cell
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (selectedId == null) return;
      const cell = this.gameState?.cells?.[selectedId];
      if (!cell || cell.fixed) return;
      if (cell.v !== 0) {
        this._dispatch({ type: 'BOARD/CLEAR_CELL', payload: { id: selectedId, peerId: this.multiplayerState?.peerId || null } });
      } else if (cell.c?.length > 0) {
        this._dispatch({ type: 'BOARD/CLEAR_CANDIDATES', payload: { id: selectedId } });
      }
      return;
    }

    // Toggle input mode
    if ((e.key === 'v' || e.key === 'V') && !this._shiftHeld) {
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: 'VALUE' } });
      return;
    }
    if ((e.key === 'c' || e.key === 'C') && !this._shiftHeld) {
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: 'CANDIDATE' } });
      return;
    }

    // Deselect
    if (e.key === 'Escape') {
      this._dispatch({ type: 'UI/SELECT_CELL', payload: { id: null } });
      return;
    }
  }

  _handleKeyUp(e) {
    if (e.key === 'Shift' && this._shiftHeld) {
      this._shiftHeld = false;
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: this._preShiftMode } });
      this._preShiftMode = null;
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('modifiers')) {
      const prev = changedProperties.get('modifiers');
      const prevLastSwap = prev?.modState?.LIVING?.lastSwap;
      const currLastSwap = this.modifiers?.modState?.LIVING?.lastSwap;
      if (currLastSwap && currLastSwap !== prevLastSwap) {
        this.classList.add('living-flash');
        setTimeout(() => this.classList.remove('living-flash'), 350);
      }
    }
  }

  firstUpdated() {
    this.focus();
  }

  reinitialize() {
    this.focus();
  }

  _dispatch(action) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: action,
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this.gameState || !this.gameState.cells) return html`<div>Loading...</div>`;

    const highlightedIds = this.settingsState?.highlightPeers !== false
      ? getHighlightedIds(this.uiState.selectedId, this.gameState.regions)
      : [];
    const conflictIds = getConflictIds(this.gameState.cells, this.gameState.regions);

    const activeModifiers = this.modifiers?.active || [];
    const modState = this.modifiers?.modState || {};
    const isCandidateOnly = activeModifiers.includes('CANDIDATE_ONLY');

    // Blackout: per-cell revealed tracking
    const isBlackout = activeModifiers.includes('BLACKOUT');
    const blackoutRevealed = isBlackout ? (modState['BLACKOUT']?.revealed || []) : null;
    const globalModClasses = isBlackout
      ? activeModifiers.filter(id => id !== 'BLACKOUT')
      : activeModifiers;

    // Symbols: emoji substitution
    const symbolsList = modState['SYMBOLS']?.symbols || null;

    return html`
      <div class="grid">
        ${repeat(this.gameState.cells, (cell) => cell.id, (cell) => {
          const borderClasses = getRegionBorderClasses(cell.id, this.gameState.regions);
          const blackoutClass = blackoutRevealed !== null
            ? [blackoutRevealed.includes(cell.id) ? 'mod-blackout-revealed' : 'mod-blackout-hidden']
            : [];
          const allModClasses = [...globalModClasses, ...blackoutClass, ...borderClasses];

          const regionColor = (this.settingsState?.regionColors) ? getRegionColor(cell.region) : '';
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
              .symbols="${symbolsList}"
              .fixed="${cell.fixed}"
              .regionIndex="${cell.region}"
              .regionColor="${regionColor}"
              .flashType="${flashType}"
              .placedByColor="${placedByColor}"
              ?selected="${this.uiState.selectedId === cell.id}"
              ?highlighted="${highlightedIds.includes(cell.id)}"
              ?conflict="${conflictIds.includes(cell.id)}"
              ?mistake="${!cell.fixed && cell.v > 0 && cell.v !== cell.solution}"
              .modClasses="${allModClasses}"
              ?readonly="${this.uiState?.viewingSolution}"
              ?candidateOnly="${isCandidateOnly}"
            ></sudoku-cell>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('sudoku-board', SudokuBoard);
