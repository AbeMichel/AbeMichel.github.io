import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './mp-player-list.js';
import { leaveRoom } from '../services/multiplayerClient.js';

export class MpLobby extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    multiplayerState: { type: Object },
    settingsState: { type: Object },
    _copyFeedback: { type: Boolean, state: true }
  };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      width: 100%;
      box-sizing: border-box;
    }

    .lobby-card {
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 28px;
      box-shadow: var(--glass-shadow);
      width: min(92vw, 480px);
      box-sizing: border-box;
    }

    .room-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid var(--glass-border);
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
    }

    .room-header h2 {
      font-family: var(--font-display);
      font-weight: 500;
      font-size: 1.2rem;
      color: var(--text-primary);
      margin: 0;
    }

    .room-code {
      font-family: var(--font-numbers);
      font-size: 1rem;
      color: var(--text-primary);
      background: var(--chip-bg);
      padding: 4px 10px;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }

    .room-code:hover {
      box-shadow: var(--chip-shadow-hover);
    }

    .section {
      width: 100%;
      margin-bottom: 1.5rem;
    }

    .section h3 {
      margin-top: 0;
      margin-bottom: 0.75rem;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 0.85rem;
      color: var(--text-accent);
      letter-spacing: 0.03em;
    }

    .config-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    label {
      font-family: var(--font-ui);
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text-secondary);
    }

    select {
      padding: 8px 10px;
      border-radius: var(--radius-chip);
      border: 1px solid var(--glass-border);
      background: var(--glass-bg);
      color: var(--text-primary);
      font-family: var(--font-ui);
      font-size: 0.9rem;
    }

    .player-list-container {
      background: var(--chip-bg);
      border-radius: var(--radius-md);
      padding: 1rem;
      min-height: 80px;
    }

    .footer-actions {
      width: 100%;
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
      gap: 8px;
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

    .btn-primary {
      background: var(--chip-bg);
      color: var(--chip-color);
    }

    .btn-primary:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      box-shadow: none;
    }

    .btn-secondary {
      background: var(--chip-bg);
      color: var(--text-secondary);
    }

    .btn-ready {
      background: var(--chip-bg);
      color: var(--num-placed);
    }

    .btn-unready {
      background: var(--chip-active-bg);
      color: var(--chip-active-color);
    }

    .spinner {
      margin: 2rem auto;
      border: 3px solid var(--glass-border);
      width: 32px;
      height: 32px;
      border-radius: var(--radius-circle);
      border-left-color: var(--text-accent);
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  _copyCode() {
    navigator.clipboard.writeText(this.multiplayerState.roomCode);
    this._copyFeedback = true;
    setTimeout(() => { this._copyFeedback = false; }, 2000);
  }

  _onConfigChange(field, value) {
    if (!this.multiplayerState.isHost) return;
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: {
        type: 'MP/UPDATE_LOBBY_CONFIG',
        payload: { [field]: value }
      },
      bubbles: true,
      composed: true
    }));
  }

  _toggleReady() {
    const localPeer = this.multiplayerState.peers.find(p => p.id === this.multiplayerState.peerId);
    const newStatus = !localPeer?.confirmed;
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { 
        type: 'MP/GUEST_CONFIRM', 
        payload: { peerId: this.multiplayerState.peerId, confirmed: newStatus } 
      },
      bubbles: true,
      composed: true
    }));
  }

  _startGame() {
    if (!this.multiplayerState.isHost) return;
    const { mpMode, difficulty } = this.multiplayerState.lobbyConfig || { mpMode: 'CO_OP', difficulty: 'MEDIUM' };
    const seed = String(Date.now());
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: {
        type: 'GAME/START',
        payload: {
          difficulty,
          mpMode,
          mode: mpMode === 'CO_OP' ? 'STANDARD' : 'STANDARD',
          seed,
        }
      },
      bubbles: true,
      composed: true
    }));
  }

  _leave() {
    leaveRoom();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'UI/SET_VIEW', payload: { view: 'MENU' } },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const { status, isHost, roomCode, peers, peerId } = this.multiplayerState;

    if (status === 'CONNECTING') {
      return html`
        <div class="lobby-card" style="text-align:center;">
          <div class="spinner"></div>
          <p style="font-family:var(--font-display);font-style:italic;color:var(--text-secondary);margin:0;">Connecting to room…</p>
        </div>
      `;
    }

    const allConfirmed = peers.every(p => p.isHost || p.confirmed);
    const localPeer = peers.find(p => p.id === peerId);

    return html`
      <div class="lobby-card">
        <div class="room-header">
          <h2>Multiplayer Lobby</h2>
          <div class="room-code" @click="${this._copyCode}" title="Click to copy">
            ${this._copyFeedback ? 'Copied!' : `Code: ${roomCode}`}
          </div>
        </div>

        <div class="section">
          <h3>Game Configuration</h3>
          <div class="config-grid">
            <div class="control-group">
              <label>Mode</label>
              <select id="mpMode"
                .value="${this.multiplayerState.lobbyConfig?.mpMode || 'CO_OP'}"
                ?disabled="${!isHost}"
                @change="${e => this._onConfigChange('mpMode', e.target.value)}">
                <option value="CO_OP">Co-op</option>
                <option value="COMPETITIVE">Competitive</option>
                <option value="VERSUS" disabled>Versus (Coming Soon)</option>
              </select>
            </div>
            <div class="control-group">
              <label>Difficulty</label>
              <select id="difficulty"
                .value="${this.multiplayerState.lobbyConfig?.difficulty || 'MEDIUM'}"
                ?disabled="${!isHost}"
                @change="${e => this._onConfigChange('difficulty', e.target.value)}">
                <option value="VERY_EASY">Very Easy</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
                <option value="VERY_HARD">Very Hard</option>
              </select>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>Players (${peers.length})</h3>
          <div class="player-list-container">
            <mp-player-list
              .peers="${peers}"
              .localPeerId="${peerId}"
            ></mp-player-list>
          </div>
        </div>

        <div class="footer-actions">
          <button class="btn-secondary" @click="${this._leave}">
            ${isHost ? 'Cancel' : 'Leave'}
          </button>

          ${isHost ? html`
            <button class="btn-primary" ?disabled="${!allConfirmed}" @click="${this._startGame}">
              Start Game
            </button>
          ` : html`
            <button class="${localPeer?.confirmed ? 'btn-unready' : 'btn-ready'}" @click="${this._toggleReady}">
              ${localPeer?.confirmed ? 'Unready' : 'Ready Up'}
            </button>
          `}
        </div>
      </div>
    `;
  }
}

customElements.define('mp-lobby', MpLobby);
