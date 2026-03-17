import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { leaveRoom } from '../services/multiplayerClient.js';

export class ResultScreen extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    settingsState: { type: Object }
  };

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(60, 40, 20, 0.4);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 100;
      padding: 2rem;
      box-sizing: border-box;
    }

    @keyframes fade-up {
      0%   { opacity: 0; transform: translateY(24px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .result-card {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 36px 40px;
      box-shadow: var(--glass-shadow);
      text-align: center;
      min-width: 320px;
      max-width: 560px;
      width: 100%;
      animation: fade-up 0.35s ease-out forwards;
    }

    .winner-text {
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .winner-name {
      color: var(--winner-color, var(--text-accent));
    }

    .winner-sub {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 16px;
      color: var(--text-accent);
      margin-bottom: 24px;
    }

    table {
      width: 100%;
      margin: 1.5rem 0;
      border-collapse: collapse;
    }

    th {
      text-align: left;
      border-bottom: 1px solid var(--glass-border);
      padding: 0.5rem;
      color: var(--text-secondary);
      font-family: var(--font-ui);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    td {
      padding: 0.75rem 0.5rem;
      border-bottom: 1px solid var(--glass-border);
      font-family: var(--font-ui);
      color: var(--text-primary);
    }

    .is-local {
      background: rgba(200, 130, 90, 0.08);
      font-weight: 600;
    }

    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }

    button {
      padding: 10px 18px;
      border-radius: var(--radius-chip);
      border: none;
      cursor: pointer;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 0.95rem;
      color: var(--chip-color);
      background: var(--chip-bg);
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }

    button:active {
      box-shadow: var(--chip-shadow-active);
      transform: scale(0.97);
    }

    button:disabled {
      opacity: 0.45;
      cursor: wait;
    }

    .btn-danger {
      background: var(--chip-active-bg);
      color: var(--chip-active-color);
    }

    .time {
      font-family: var(--font-numbers);
    }
  `;

  _formatTime(ms) {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _playAgain() {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'COMPETITIVE/PLAY_AGAIN' },
      bubbles: true,
      composed: true
    }));
  }

  _changeSettings() {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'MP/RETURN_TO_LOBBY' },
      bubbles: true,
      composed: true
    }));
  }

  _quit() {
    leaveRoom();
    this._dispatch({ type: 'UI/CLOSE_WIN_MODAL' });
    this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'MENU' } });
  }

  _dispatch(detail) {
    this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
  }

  _renderSingleplayer() {
    const { timer, mistakes, difficulty, seed } = this.gameState;
    return html`
      <div class="result-card">
        <div class="winner-text">Puzzle solved</div>
        <div class="winner-sub">Well done</div>
        <table>
          <tbody>
            <tr>
              <td style="text-align:left;color:var(--text-secondary);font-family:var(--font-ui);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;">Time</td>
              <td class="time">${this._formatTime(timer)}</td>
            </tr>
            <tr>
              <td style="text-align:left;color:var(--text-secondary);font-family:var(--font-ui);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;">Mistakes</td>
              <td>${mistakes ?? 0}</td>
            </tr>
            <tr>
              <td style="text-align:left;color:var(--text-secondary);font-family:var(--font-ui);font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;">Difficulty</td>
              <td>${difficulty ?? '—'}</td>
            </tr>
          </tbody>
        </table>
        <div class="actions">
          <button @click="${() => { this._dispatch({ type: 'UI/CLOSE_WIN_MODAL' }); this._dispatch({ type: 'GAME/START', payload: { seed, difficulty, mode: 'STANDARD' } }); }}">Play Again</button>
          <button @click="${() => this._dispatch({ type: 'UI/CLOSE_WIN_MODAL' })}">View Solution</button>
          <button @click="${() => { this._dispatch({ type: 'UI/CLOSE_WIN_MODAL' }); this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'MENU' } }); }}">New Game</button>
        </div>
      </div>
    `;
  }

  render() {
    const result = this.uiState.competitiveResult;
    if (!result) return this._renderSingleplayer();

    const winnerPeer = this.multiplayerState.peers.find(p => p.id === result.winnerId) || 
                       (result.winnerId === this.multiplayerState.peerId ? { name: this.multiplayerState.playerName, color: '#42A5F5' } : null);
    
    const sortedResults = [...result.results].sort((a, b) => {
      if (a.finished && !b.finished) return -1;
      if (!a.finished && b.finished) return 1;
      return (a.time || Infinity) - (b.time || Infinity);
    });

    return html`
      <div class="result-card" style="--winner-color: ${winnerPeer?.color || 'var(--text-accent)'}">
        <div class="winner-text"><span class="winner-name">${result.winnerName}</span> wins!</div>
        <div class="winner-sub">Puzzle solved</div>
        
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Time</th>
              <th>Mistakes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${sortedResults.map(r => html`
              <tr class="${r.peerId === this.multiplayerState.peerId ? 'is-local' : ''}">
                <td style="text-align: left;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${this.multiplayerState.peers.find(p => p.id === r.peerId)?.color || '#42A5F5'}; margin-right: 8px;"></span>
                  ${r.name}
                </td>
                <td class="time">${this._formatTime(r.time)}</td>
                <td>${r.mistakes}</td>
                <td>${r.finished ? 'Solved ✓' : 'DNF'}</td>
              </tr>
            `)}
          </tbody>
        </table>

        <div class="actions">
          ${this.multiplayerState.isHost ? html`
            <button class="btn-primary" @click="${this._playAgain}">Play Again</button>
          ` : html`
            <button class="btn-primary" disabled>Waiting for host...</button>
          `}
          <button class="btn-secondary" @click="${this._changeSettings}">Change Settings</button>
          <button class="btn-danger" @click="${this._quit}">Quit</button>
        </div>
      </div>
    `;
  }
}

customElements.define('result-screen', ResultScreen);
