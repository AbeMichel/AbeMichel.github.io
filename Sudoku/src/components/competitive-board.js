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
      padding: 1rem;
      box-sizing: border-box;
    }

    .progress-container {
      width: 100%;
      max-width: 1100px;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .player-progress {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .player-info {
      width: 120px;
      font-family: var(--font-display);
      font-size: 0.9rem;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .player-info.disconnected {
      opacity: 0.45;
      text-decoration: line-through;
      font-style: italic;
    }

    .bar-bg {
      flex: 1;
      height: 8px;
      background: rgba(180, 110, 80, 0.15);
      border-radius: var(--radius-sm);
      position: relative;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      transition: width 0.3s ease-out;
    }

    .game-area {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      gap: 2rem;
      width: 100%;
      max-width: 1200px;
    }

    .vs-divider {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 2rem;
      color: var(--text-secondary);
      align-self: center;
    }

    .board-side {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
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

    @media (max-width: 900px) {
      .game-area {
        flex-direction: column;
        align-items: center;
      }
      .vs-divider {
        display: none;
      }
      .opponent-board {
        width: 200px;
        height: 200px;
      }
    }
  `;

  render() {
    const { peerId, peers, competitiveBoards } = this.multiplayerState;
    const allPlayers = peers.map(p => ({ ...p, isLocal: p.id === peerId }));

    return html`
      <div class="progress-container">
        ${allPlayers.map(p => {
          const board = p.isLocal ? this._getLocalBoardStats() : competitiveBoards[p.id];
          const percent = board ? (board.filledCount / 81) * 100 : 0;
          const color = p.isLocal ? 'var(--progress-player)' : (p.color || 'var(--progress-opponent)');

          return html`
            <div class="player-progress">
              <div class="player-info ${p.connected === false ? 'disconnected' : ''}">${p.name}</div>
              <div class="bar-bg">
                <div class="bar-fill" style="width: ${percent}%; background-color: ${color}"></div>
              </div>
            </div>
          `;
        })}
      </div>

      <div class="game-area">
        <div class="board-side">
          <sudoku-board
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiers}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
            .viewingSolution="${this.uiState?.viewingSolution ?? false}"
          ></sudoku-board>
        </div>

        <div class="vs-divider">vs</div>

        <div class="board-side">
          ${this.settingsState.showOpponentBoard ? this._renderOpponents() : html`<div>Opponent board hidden</div>`}
        </div>
      </div>
    `;
  }

  _getLocalBoardStats() {
    const cells = this.gameState.cells;
    const filledCount = cells.filter(c => !c.fixed && c.v > 0).length;
    return { filledCount };
  }

  _renderOpponents() {
    const { peerId, peers, competitiveBoards } = this.multiplayerState;
    const opponents = peers.filter(p => p.id !== peerId);

    if (opponents.length === 0) return html`<div>Waiting for opponents...</div>`;

    return html`
      ${opponents.map(opp => {
        const board = competitiveBoards[opp.id];
        const cells = board?.cells || [];
        
        return html`
          <div class="opponent-label" style="font-weight: bold; margin-bottom: 0.5rem;">${opp.name}</div>
          <div class="opponent-board" style="--opponent-color: ${opp.color}">
            ${Array.from({ length: 81 }).map((_, i) => {
              const cell = cells[i];
              const isFixed = this.gameState.cells[i]?.fixed;
              const isFilled = cell && !cell.fixed && cell.v > 0;
              
              return html`
                <div class="opponent-cell ${isFixed ? 'is-fixed' : ''} ${isFilled ? 'is-filled' : ''}"></div>
              `;
            })}
          </div>
        `;
      })}
    `;
  }
}

customElements.define('competitive-board', CompetitiveBoard);
