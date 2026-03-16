import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { repeat } from 'https://esm.sh/lit@3/directives/repeat.js';
import './sudoku-cell.js';
import { getRow, getCol, getHighlightedIds, getConflictIds, getRegionBorderClasses } from '../utils/boardGeometry.js';
import { getRegionColor } from '../config/regionColors.js';

export class SudokuBoard extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    modifiers: { type: Object },
    settingsState: { type: Object }
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
    }

    .grid {
      display: contents; /* Grid logic is now on host */
    }
  `;

  constructor() {
    super();
    this.tabIndex = 0; // Make board focusable
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('keydown', (e) => {
      this.handleInput(e);
    });
  }

  handleInput(e) {
    const selectedId = this.uiState?.selectedId;
    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      if (selectedId == null) return;
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
    if (/^[1-9]$/.test(e.key)) {
      if (selectedId == null) return;
      const cell = this.gameState?.cells?.[selectedId];
      if (!cell || cell.fixed) return;
      const actionType = this.uiState?.inputMode === 'CANDIDATE'
        ? 'BOARD/SET_CANDIDATE'
        : 'BOARD/SET_VALUE';
      this._dispatch({ type: actionType, payload: { id: selectedId, value: parseInt(e.key) } });
      return;
    }

    // Clear cell
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (selectedId == null) return;
      const cell = this.gameState?.cells?.[selectedId];
      if (!cell || cell.fixed) return;
      this._dispatch({ type: 'BOARD/CLEAR_CELL', payload: { id: selectedId } });
      return;
    }

    // Toggle input mode
    if (e.key === 'v' || e.key === 'V') {
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: 'VALUE' } });
      return;
    }
    if (e.key === 'c' || e.key === 'C') {
      this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode: 'CANDIDATE' } });
      return;
    }

    // Deselect
    if (e.key === 'Escape') {
      this._dispatch({ type: 'UI/SELECT_CELL', payload: { id: null } });
      return;
    }
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

    const highlightedIds = getHighlightedIds(this.uiState.selectedId, this.gameState.regions);
    const conflictIds = getConflictIds(this.gameState.cells, this.gameState.regions);

    return html`
      <div class="grid">
        ${repeat(this.gameState.cells, (cell) => cell.id, (cell) => {
          const borderClasses = getRegionBorderClasses(cell.id, this.gameState.regions);
          const modifierClasses = this.modifiers ? this.modifiers.active : [];
          const allModClasses = [...modifierClasses, ...borderClasses];
          
          const regionColor = (this.settingsState?.regionColors) ? getRegionColor(cell.region) : '';

          return html`
            <sudoku-cell
              .cellId="${cell.id}"
              .value="${cell.v || 0}"
              .candidates="${cell.c || []}"
              .fixed="${cell.fixed}"
              .regionIndex="${cell.region}"
              .regionColor="${regionColor}"
              ?selected="${this.uiState.selectedId === cell.id}"
              ?highlighted="${highlightedIds.includes(cell.id)}"
              ?conflict="${conflictIds.includes(cell.id)}"
              .modClasses="${allModClasses}"
            ></sudoku-cell>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('sudoku-board', SudokuBoard);
