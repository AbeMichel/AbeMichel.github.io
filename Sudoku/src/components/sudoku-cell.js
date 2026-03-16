import { LitElement, html, css } from 'https://esm.sh/lit@3';

export class SudokuCell extends LitElement {
  static properties = {
    cellId: { type: Number },
    value: { type: Number },
    candidates: { type: Array },
    fixed: { type: Boolean },
    selected: { type: Boolean },
    highlighted: { type: Boolean },
    conflict: { type: Boolean },
    modClasses: { type: Array },
    regionIndex: { type: Number },
    regionColor: { type: String },
    pieceColor: { type: String },
    pieceBorderClasses: { type: Array },
    flashType: { type: String },
    placedByColor: { type: String }
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      aspect-ratio: 1;
      box-sizing: border-box;
      border: 1px solid var(--cell-border, #ccc);
      background-color: var(--cell-bg, #f0f0f0);
      transition: background-color 0.2s ease;
      cursor: pointer;
      user-select: none;
      position: relative;
    }

    @keyframes flash-conflict {
      0%   { background-color: var(--cell-conflict-bg, #ffcdd2); }
      100% { background-color: var(--cell-bg, #f0f0f0); }
    }

    :host(.flash-conflict) {
      animation: flash-conflict 0.6s ease-out;
    }

    :host(.has-player-color)::after {
      content: '';
      position: absolute;
      top: 4px;
      left: 4px;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--player-color);
      box-shadow: 0 1px 2px rgba(0,0,0,0.3);
      z-index: 2;
    }

    :host(.region-border-top)    { border-top: 2px solid var(--region-border-color, #333); }
    :host(.region-border-left)   { border-left: 2px solid var(--region-border-color, #333); }
    :host(.region-border-bottom) { border-bottom: 2px solid var(--region-border-color, #333); }
    :host(.region-border-right)  { border-right: 2px solid var(--region-border-color, #333); }

    :host(.has-piece) .cell {
      box-shadow:
        inset 2px 2px 4px rgba(255, 255, 255, 0.5),   /* top-left highlight */
        inset -2px -2px 4px rgba(0, 0, 0, 0.2);        /* bottom-right shadow */
    }

    :host(.piece-border-top.has-piece),
    :host(.piece-border-left.has-piece),
    :host(.piece-border-bottom.has-piece),
    :host(.piece-border-right.has-piece) {
      filter: drop-shadow(0px 2px 3px rgba(0, 0, 0, 0.25));
    }

    :host(.piece-border-top)    { border-top: 2px solid var(--piece-border-color, #555) !important; }
    :host(.piece-border-left)   { border-left: 2px solid var(--piece-border-color, #555) !important; }
    :host(.piece-border-bottom) { border-bottom: 2px solid var(--piece-border-color, #555) !important; }
    :host(.piece-border-right)  { border-right: 2px solid var(--piece-border-color, #555) !important; }

    :host([highlighted]) {
      background-color: var(--cell-highlight-bg, #fcfcda);
    }

    :host([selected]) {
      background-color: var(--cell-selected-bg, #b3e5fc);
      outline: 2px solid var(--cell-selected-outline, #2196f3);
      z-index: 1;
    }

    :host([conflict]) {
      background-color: var(--cell-conflict-bg, #ffcdd2);
    }

    .cell {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      background-color: var(--piece-tint, transparent);
    }

    .cell::before {
      content: '';
      position: absolute;
      inset: 0;
      background-color: var(--piece-tint, transparent);
      opacity: 0.35;
      pointer-events: none;
      z-index: 0;
    }

    .value {
      font-size: 2rem;
      font-weight: bold;
      color: var(--cell-value-color, #333);
      transition: opacity 0.2s ease, transform 0.2s ease;
      pointer-events: none;
      z-index: 1;
    }

    :host([fixed]) .value {
      color: var(--cell-fixed-color, #000);
    }

    :host([conflict]) .value {
      color: var(--cell-conflict-color, #d32f2f);
    }

    .value:empty {
      opacity: 0;
    }

    .candidates {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      padding: 2px;
      box-sizing: border-box;
      pointer-events: none;
      z-index: 1;
    }

    .candidate {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.6rem;
      color: var(--candidate-color, #777);
      opacity: 0;
      transition: opacity 0.2s ease;
      pointer-events: auto;
    }

    .candidate.is-active {
      opacity: 1;
    }

    /* Pop animation on value change */
    @keyframes pop {
      0% { transform: scale(0.5); opacity: 0; }
      70% { transform: scale(1.2); }
      100% { transform: scale(1); opacity: 1; }
    }

    :host([data-just-placed]) .value {
      animation: pop 0.2s ease-out;
    }
  `;

  constructor() {
    super();
    this.cellId = 0;
    this.value = 0;
    this.candidates = [];
    this.fixed = false;
    this.selected = false;
    this.highlighted = false;
    this.conflict = false;
    this.modClasses = [];
    this.regionIndex = 0;
    this.regionColor = '';
    this.pieceColor = '';
    this.pieceBorderClasses = [];
    this._handleClick = this._handleClick.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('click', this._handleClick);
  }

  updated(changedProperties) {
    if (changedProperties.has('value')) {
      const oldValue = changedProperties.get('value');
      if (this.value !== 0 && oldValue === 0) {
        this.setAttribute('data-just-placed', '');
        setTimeout(() => this.removeAttribute('data-just-placed'), 200);
      }
    }
    
    if (changedProperties.has('modClasses') || changedProperties.has('pieceBorderClasses') || changedProperties.has('flashType') || changedProperties.has('placedByColor')) {
      const mods = this.modClasses || [];
      const borders = this.pieceBorderClasses || [];
      const flash = this.flashType ? [`flash-${this.flashType}`] : [];
      const playerColor = this.placedByColor ? ['has-player-color'] : [];
      this.className = [...mods, ...borders, ...flash, ...playerColor].join(' ');
      
      if (this.placedByColor) {
        this.style.setProperty('--player-color', this.placedByColor);
      } else {
        this.style.removeProperty('--player-color');
      }
    }
  }

  _handleClick(e) {
    if (e.target.closest('.candidate')) return;
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'UI/SELECT_CELL', payload: { id: this.cellId } },
      bubbles: true,
      composed: true
    }));
  }

  _handleCandidateClick(e, digit) {
    if (!this.selected) return; // Let click bubble to _handleClick for selection
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'BOARD/SET_CANDIDATE', payload: { id: this.cellId, value: digit } },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const cellStyle = this.pieceColor ? `--piece-tint: ${this.pieceColor};` : '';
    const innerStyle = this.regionColor ? `background-color: ${this.regionColor};` : '';

    return html`
      <div class="cell" style="${cellStyle}${innerStyle}">
        ${this.value !== 0 ? html`
          <span class="value">${this.value}</span>
        ` : html`
          <div class="candidates">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => html`
              <span 
                class="candidate ${this.candidates.includes(digit) ? 'is-active' : ''}"
                data-digit="${digit}"
                @click="${(e) => this._handleCandidateClick(e, digit)}"
              >
                ${digit}
              </span>
            `)}
          </div>
        `}
      </div>
    `;
  }
}

customElements.define('sudoku-cell', SudokuCell);
