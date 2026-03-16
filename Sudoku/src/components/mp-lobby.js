import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './mp-player-list.js';
import { leaveRoom } from '../services/multiplayerClient.js';

export class MpLobby extends LitElement {
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
      max-width: 600px;
      margin: 2rem auto;
      padding: 1.5rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      box-sizing: border-box;
    }

    .room-header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #f0f0f0;
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
    }

    .room-code {
      font-family: monospace;
      font-size: 1.2rem;
      background: #f5f5f5;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
    }

    .room-code:hover {
      background: #e0e0e0;
    }

    .section {
      width: 100%;
      margin-bottom: 1.5rem;
    }

    .section h3 {
      margin-top: 0;
      font-size: 0.9rem;
      text-transform: uppercase;
      color: #777;
      letter-spacing: 0.05em;
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
      font-size: 0.85rem;
      font-weight: bold;
    }

    select {
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #ccc;
    }

    .player-list-container {
      background: #fafafa;
      border-radius: 4px;
      padding: 1rem;
      min-height: 100px;
    }

    .footer-actions {
      width: 100%;
      display: flex;
      justify-content: space-between;
      margin-top: 1rem;
    }

    button {
      padding: 10px 20px;
      border-radius: 4px;
      border: none;
      cursor: pointer;
      font-weight: bold;
      font-size: 1rem;
    }

    .btn-primary {
      background: #4caf50;
      color: white;
    }

    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #333;
    }

    .btn-ready {
      background: #2196f3;
      color: white;
    }

    .btn-unready {
      background: #ff5722;
      color: white;
    }

    .spinner {
      margin: 2rem;
      border: 4px solid rgba(0,0,0,0.1);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border-left-color: #2196f3;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  _copyCode() {
    navigator.clipboard.writeText(this.multiplayerState.roomCode);
    alert('Room code copied to clipboard!');
  }

  _onConfigChange(e, key) {
    if (!this.multiplayerState.isHost) return;
    
    let actionType, payload;
    if (key === 'mpMode') {
      actionType = 'MP/CONNECT'; // We don't have a dedicated mpMode action, but it's in mp state
      payload = { ...this.multiplayerState, mpMode: e.target.value };
    } else if (key === 'difficulty') {
      // For now we'll just handle it during GAME/START
    }
    
    // Dispatch local update or broadcast
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

    const difficulty = this.shadowRoot.querySelector('#difficulty').value;
    const mpMode = this.shadowRoot.querySelector('#mpMode').value;

    const seed = Date.now();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { 
        type: 'GAME/START', 
        payload: { 
          difficulty, 
          mpMode,
          mode: 'STANDARD', // Default for now
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
        <div class="spinner"></div>
        <p>Connecting to room...</p>
      `;
    }

    const allConfirmed = peers.every(p => p.isHost || p.confirmed);
    const localPeer = peers.find(p => p.id === peerId);

    return html`
      <div class="room-header">
        <h2>Multiplayer Lobby</h2>
        <div class="room-code" @click="${this._copyCode}" title="Click to copy">
          Code: ${roomCode}
        </div>
      </div>

      <div class="section">
        <h3>Game Configuration</h3>
        <div class="config-grid">
          <div class="control-group">
            <label>Mode</label>
            <select id="mpMode" ?disabled="${!isHost}" @change="${e => this._onConfigChange(e, 'mpMode')}">
              <option value="CO_OP" ?selected="${this.multiplayerState.mpMode === 'CO_OP'}">Co-op</option>
              <option value="COMPETITIVE" ?selected="${this.multiplayerState.mpMode === 'COMPETITIVE'}">Competitive</option>
              <option value="VERSUS" ?selected="${this.multiplayerState.mpMode === 'VERSUS'}">Versus</option>
            </select>
          </div>
          <div class="control-group">
            <label>Difficulty</label>
            <select id="difficulty" ?disabled="${!isHost}">
              <option value="VERY_EASY">Very Easy</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM" selected>Medium</option>
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
    `;
  }
}

customElements.define('mp-lobby', MpLobby);
