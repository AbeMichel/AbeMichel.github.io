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

    .controls-col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 8px;
    }

    .vs-divider {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 2rem;
      color: var(--text-secondary);
      align-self: center;
    }

    .opponents-side {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      align-items: center;
    }

    .opponent-wrap {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .opponent-label {
      font-family: var(--font-display);
      font-size: 13px;
      font-style: italic;
      color: var(--text-secondary);
    }

    .opponent-label.disconnected {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .opponent-board {
      display: grid;
      grid-template-columns: repeat(9, 1fr);
      width: 300px;
      height: 300px;
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
      width: 300px;
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
      }

      .local-side {
        flex-direction: column;
        align-items: center;
      }

      .controls-col {
        padding-top: 0;
        align-items: center;
      }

      .vs-divider {
        display: none;
      }

      .opponent-board {
        width: 200px;
        height: 200px;
      }

      .bar-bg {
        width: 200px;
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
        const actionType = inputMode === 'CANDIDATE' ? 'BOARD/SET_CANDIDATE' : 'BOARD/SET_VALUE';
        const payload = { id: selectedId, value: n, peerId };
        if (actionType === 'BOARD/SET_CANDIDATE') payload.autoCandidates = this.settingsState?.autoCandidates ?? false;
        this._dispatch({ type: actionType, payload });
      }}">
        ${n}
      </button>`;

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

          <div class="controls-col">
            <div style="display:flex;gap:6px;">
              ${modeChip('Value', 'VALUE')}
              ${modeChip('Candidate', 'CANDIDATE')}
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;">
              ${[1,2,3,4,5,6,7,8,9].map(n => numChip(n))}
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
            }}">Erase</button>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;padding:6px 2px;">
              <span style="font-family:var(--font-display);font-style:italic;font-size:12px;color:var(--text-secondary);">Auto candidates</span>
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
            </div>
          </div>
        </div>

        <div class="vs-divider">vs</div>

        <div class="opponents-side">
          ${this._renderOpponents(peers, peerId, competitiveBoards)}
        </div>
      </div>
    `;
  }

  _renderOpponents(peers, peerId, competitiveBoards) {
    const opponents = peers.filter(p => p.id !== peerId);

    if (opponents.length === 0) return html`
      <div style="font-family:var(--font-display);font-style:italic;font-size:14px;color:var(--text-secondary);">
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
