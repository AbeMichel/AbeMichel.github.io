import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './sudoku-board.js';

export class CompetitiveBoard extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    settingsState: { type: Object }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      box-sizing: border-box;
    }

    .game-area {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 2rem;
      width: 100%;
      max-width: 1200px;
    }

    .local-side {
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

    .vs-divider {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 2rem;
      color: var(--text-secondary);
      align-self: center;
    }

    .opponents-side {
      display: grid;
      grid-template-columns: repeat(var(--cols, 1), 1fr);
      gap: 1.5rem;
      align-items: start;
      width: 100%;
      flex: 1;
    }

    .opponent-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }

    .opponent-label {
      font-family: var(--font-display);
      font-size: 13px;
      font-style: italic;
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .opponent-label.disconnected {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .opponent-board {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      width: 100%;
      aspect-ratio: 1 / 1;
      background: var(--board-bg);
      border: 1px solid var(--board-border);
      box-shadow: var(--board-shadow);
      border-radius: var(--radius-sm);
      gap: 1px;
    }

    .opponent-cell {
      background: rgba(240, 238, 250, 0.7);
    }

    .opponent-cell.is-fixed {
      background: rgba(120, 100, 160, 0.4);
    }

    .opponent-cell.is-filled {
      background: var(--opponent-color, rgba(140,120,180,0.28));
    }

    .bar-bg {
      width: 100%;
      height: 6px;
      background: rgba(180, 110, 80, 0.15);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: var(--radius-sm);
      transition: width 0.3s ease-out;
    }

    @media (max-width: 900px) {
      .game-area {
        flex-direction: column;
        align-items: center;
        gap: 1.5rem;
      }

      .local-side {
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 540px;
        gap: 16px;
      }

      .desktop-controls {
        display: none;
      }

      .mobile-controls {
        display: flex;
        width: min(90vw, 540px);
      }

      .vs-divider {
        display: none;
      }

      .opponent-board {
        width: 100%;
        max-width: 260px;
        margin: 0 auto;
      }

      .bar-bg {
        width: 100%;
        max-width: 260px;
        margin: 0 auto;
      }
      
      .opponents-side {
        width: 100%;
        padding: 0 1rem;
        box-sizing: border-box;
      }
    }
  `;

  _dispatch(detail) {
    this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
  }

  render() {
    const { peerId, peers, competitiveBoards } = this.multiplayerState;
    const inputMode = this.uiState?.inputMode || 'VALUE';
    const selectedId = this.uiState?.selectedId;

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
        " @mousedown="${e => e.preventDefault()}" @click="${() => this._dispatch({ type: 'UI/SET_INPUT_MODE', payload: { mode } })}">
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
        const actionType = inputMode === 'CANDIDATE' ? 'BOARD/SET_CANDIDATE' : 'BOARD/SET_VALUE';
        const payload = { id: selectedId, value: n, peerId };
        if (actionType === 'BOARD/SET_CANDIDATE') payload.autoCandidates = this.settingsState?.autoCandidates ?? false;
        this._dispatch({ type: actionType, payload });
      }}">
        ${n}
      </button>`;

    const autoToggle = () => html`
      <div style="display:flex;align-items:center;gap:12px;padding:0 4px;">
        <span style="font-family:var(--font-display);font-style:italic;font-size:12px;color:var(--text-secondary);white-space:nowrap;">Auto candidates</span>
        <div @mousedown="${e => e.preventDefault()}" @click="${() => {
          this._dispatch({ type: 'SETTINGS/SET', payload: { key: 'autoCandidates', value: !this.settingsState?.autoCandidates } });
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

    const opponents = peers.filter(p => p.id !== peerId);
    let cols = 1;
    if (opponents.length > 0) {
      let r = 1;
      while (cols * r < opponents.length) {
        if (cols <= r) cols++;
        else r++;
      }
    }

    return html`
      <div class="game-area">
        <div class="local-side">
          <sudoku-board
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiers}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
            .viewingSolution="${this.uiState?.viewingSolution ?? false}"
          ></sudoku-board>

          <!-- Desktop controls -->
          <div class="desktop-controls">
            <div style="display:flex;gap:6px;">
              ${modeChip('Value', 'VALUE')}
              ${modeChip('Candidate', 'CANDIDATE')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${[1,2,3,4,5,6,7,8,9].map(n => numChip(n, false))}
            </div>
            <button style="
              height:36px;padding:0 14px;border-radius:var(--radius-chip);
              border:none;cursor:pointer;white-space:nowrap;
              font-family:var(--font-display);font-size:12px;font-style:italic;
              color:var(--chip-color);background:var(--chip-bg);
              box-shadow:var(--chip-shadow);transition:all 0.12s;
            " @mousedown="${e => e.preventDefault()}" @click="${() => {
              const cell = this.gameState?.cells?.[selectedId];
              if (!cell || cell.fixed) return;
              if (cell.v !== 0) {
                this._dispatch({ type: 'BOARD/CLEAR_CELL', payload: { id: selectedId, peerId } });
              } else if (cell.c?.length > 0) {
                this._dispatch({ type: 'BOARD/CLEAR_CANDIDATES', payload: { id: selectedId } });
              }
            }}"></button>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;padding:6px 2px;">
              ${autoToggle()}
            </div>
          </div>

          <!-- Mobile controls -->
          <div class="mobile-controls">
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
                color:var(--chip-color);background:var(--chip-bg);
                box-shadow:var(--chip-shadow);transition:all 0.12s;
              " @mousedown="${e => e.preventDefault()}" @click="${() => {
                const cell = this.gameState?.cells?.[selectedId];
                if (!cell || cell.fixed) return;
                if (cell.v !== 0) {
                  this._dispatch({ type: 'BOARD/CLEAR_CELL', payload: { id: selectedId, peerId } });
                } else if (cell.c?.length > 0) {
                  this._dispatch({ type: 'BOARD/CLEAR_CANDIDATES', payload: { id: selectedId } });
                }
              }}">Erase</button>
            </div>
            <div class="control-row" style="justify-content:center;margin-top:4px;">
              ${autoToggle()}
            </div>
          </div>
        </div>

        <div class="vs-divider">vs</div>

        <div class="opponents-side" style="--cols: ${cols}">
          ${this._renderOpponents(opponents, competitiveBoards)}
        </div>
      </div>
    `;
  }

  _renderOpponents(opponents, competitiveBoards) {
    if (opponents.length === 0) return html`
      <div style="grid-column: 1 / -1; font-family:var(--font-display);font-style:italic;font-size:14px;color:var(--text-secondary);text-align:center;">
        Waiting for opponents…
      </div>`;

    return opponents.map(opp => {
      const board = competitiveBoards[opp.id];
      const cells = board?.cells || [];
      const filledCount = cells.filter(c => !c.fixed && c.v > 0).length;
      const percent = (filledCount / 81) * 100;
      const color = opp.color || 'var(--progress-opponent)';

      return html`
        <div class="opponent-wrap">
          <div class="opponent-label ${opp.connected === false ? 'disconnected' : ''}">${opp.name}</div>
          <div class="opponent-board" style="--opponent-color: ${color}">
            ${Array.from({ length: 81 }).map((_, i) => {
              const cell = cells[i];
              const isFixed = this.gameState.cells[i]?.fixed;
              const isFilled = cell && !cell.fixed && cell.v > 0;
              return html`<div class="opponent-cell ${isFixed ? 'is-fixed' : ''} ${isFilled ? 'is-filled' : ''}"></div>`;
            })}
          </div>
          <div class="bar-bg">
            <div class="bar-fill" style="width:${percent}%;background-color:${color};"></div>
          </div>
        </div>
      `;
    });
  }

  _getLocalBoardStats() {
    const cells = this.gameState.cells;
    const filledCount = cells.filter(c => !c.fixed && c.v > 0).length;
    return { filledCount };
  }
}

customElements.define('competitive-board', CompetitiveBoard);
