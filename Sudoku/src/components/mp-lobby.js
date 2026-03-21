import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { unsafeHTML } from 'https://esm.sh/lit@3/directives/unsafe-html.js';
import './mp-player-list.js';
import './modifier-picker.js';
import { leaveRoom } from '../services/multiplayerClient.js';

const ICON_SHARE = unsafeHTML(`<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8m-4-6l-4-4l-4 4m4-4v13"/></svg>`);

export class MpLobby extends LitElement {
  static properties = {
    gameState:        { type: Object },
    uiState:          { type: Object },
    multiplayerState: { type: Object },
    settingsState:    { type: Object },
    _copyFeedback:    { type: Boolean, state: true },
    _showModPicker:   { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: block;
    }

    @keyframes card-in {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .lobby-card {
      animation: card-in 0.3s ease 0.05s both;
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
      font-size: 1.1rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      color: var(--text-primary);
      background: var(--chip-bg);
      padding: 4px 12px;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }

    .room-code:hover {
      box-shadow: var(--chip-shadow-hover);
      transform: translateY(-1px);
    }

    .share-btn {
      width: 36px;
      height: 36px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.1rem;
      border-radius: var(--radius-chip);
      border: none;
      cursor: pointer;
      background: var(--chip-bg);
      color: var(--chip-color);
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }
    .share-btn:hover { box-shadow: var(--chip-shadow-hover); transform: translateY(-1px); }

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

    .mod-row {
      margin-top: 0.75rem;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .mod-chip {
      font-family: var(--font-ui);
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-accent);
      background: rgba(192,90,58,0.1);
      border: 1px solid rgba(192,90,58,0.25);
      padding: 2px 9px;
      border-radius: var(--radius-pill);
    }
    .mod-add-btn {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 12px;
      color: var(--text-secondary);
      background: transparent;
      border: 1px dashed var(--glass-border);
      border-radius: var(--radius-pill);
      padding: 3px 12px;
      cursor: pointer;
      transition: color 0.15s, border-color 0.15s;
    }
    .mod-add-btn:hover:not(:disabled) { color: var(--text-primary); border-color: var(--text-secondary); }
    .mod-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }

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
      color: var(--chip-color);
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

  async _shareLink() {
    const url = new URL(window.location.href);
    url.searchParams.set('room', this.multiplayerState.roomCode);
    const shareData = {
      title: 'Join my Sudoku game!',
      text: `Enter room ${this.multiplayerState.roomCode} to play Sudoku 2.0 with me!`,
      url: url.toString()
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') this._copyLink(url.toString());
      }
    } else {
      this._copyLink(url.toString());
    }
  }

  _copyLink(url) {
    navigator.clipboard.writeText(url);
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
    const { mpMode, difficulty, modifiers = [], modifierConfig = {} } =
      this.multiplayerState.lobbyConfig || { mpMode: 'CO_OP', difficulty: 'MEDIUM' };
    const seed = String(Date.now());
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: {
        type: 'GAME/START',
        payload: { difficulty, mpMode, mode: 'STANDARD', seed, modifiers, modifierConfig }
      },
      bubbles: true,
      composed: true
    }));
  }

  _onModifierChange(e) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: {
        type: 'MP/UPDATE_LOBBY_CONFIG',
        payload: { modifiers: e.detail.modifiers, modifierConfig: e.detail.modifierConfig }
      },
      bubbles: true,
      composed: true
    }));
    this._showModPicker = false;
  }

  _leave() {
    leaveRoom();
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'UI/SET_VIEW', payload: { view: 'MULTIPLAYER' } },
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

    const hasGuests = peers.filter(p => !p.isHost).length > 0;
    const allConfirmed = hasGuests && peers.every(p => p.isHost || p.confirmed);
    const localPeer = peers.find(p => p.id === peerId);
    const activeMods = this.multiplayerState.lobbyConfig?.modifiers || [];

    return html`
      <div class="lobby-card">
        <div class="room-header">
          <h2>Multiplayer Lobby</h2>
          <div style="display:flex;align-items:center;gap:8px;">
            <div class="room-code" @click="${this._copyCode}" title="Click to copy code">
              ${this._copyFeedback ? 'Copied!' : roomCode}
            </div>
            <button class="share-btn" @click="${this._shareLink}" title="Share invite link">
              ${ICON_SHARE}
            </button>
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
          <div class="mod-row">
            ${activeMods.map(id => html`<span class="mod-chip">${id.toLowerCase().replace(/_/g, ' ')}</span>`)}
            <button
              class="mod-add-btn"
              ?disabled="${!isHost}"
              @click="${() => this._showModPicker = true}">
              ${activeMods.length ? 'Edit modifiers' : '+ Modifiers'}
            </button>
          </div>
        </div>

        ${this._showModPicker ? html`
          <modifier-picker
            .active="${activeMods}"
            .config="${this.multiplayerState.lobbyConfig?.modifierConfig || {}}"
            @modifier-change="${this._onModifierChange}"
            @modifier-close="${() => this._showModPicker = false}"
          ></modifier-picker>
        ` : ''}

        <div class="section">
          <h3>Players (${peers.filter(p => p.connected !== false).length})</h3>
          <div class="player-list-container">
            <mp-player-list
              .peers="${peers}"
              .localPeerId="${peerId}"
              hideDisconnected
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
