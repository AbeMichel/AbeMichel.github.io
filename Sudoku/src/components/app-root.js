import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './board-container.js';
import './mp-lobby.js';
import './mp-player-list.js';
import './result-screen.js';
import './settings-modal.js';
import { getActiveModifiers } from '../modifiers/registry.js';
import { createRoom, joinRoom } from '../services/multiplayerClient.js';
import { initPetals } from '../utils/petals.js';

let _store = null;
export function setStore(storeInstance) {
  _store = storeInstance;
  window.__store = _store;
  const appRoot = document.querySelector('app-root');
  if (appRoot) appRoot._syncStore();
}

export class AppRoot extends LitElement {
  static properties = {
    gameState: { type: Object },
    uiState: { type: Object },
    modifiersState: { type: Object },
    settingsState: { type: Object },
    multiplayerState: { type: Object },
    historyState: { type: Object },
    _pendingFlow: { type: String, state: true }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      width: 100%;
      background: transparent;
      font-family: system-ui, sans-serif;
      outline: none;
    }

    .hud {
      display: flex;
      justify-content: space-between;
      width: min(90vw, 540px);
      padding: 1rem 0;
      font-weight: bold;
    }

    .menu-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
    }

    button {
      margin: 0.5rem;
      padding: 0.5rem 1rem;
      cursor: pointer;
    }

    .mp-form {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
      width: 260px;
    }

    .mp-form input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 1rem;
    }

    .mp-form .form-actions {
      display: flex;
      justify-content: space-between;
    }
  `;

  constructor() {
    super();
    this.gameState = {};
    this.uiState = {};
    this.modifiersState = {};
    this.settingsState = {};
    this.multiplayerState = {};
    this.historyState = {};
    this._pendingFlow = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this._syncStore();
    this.updateComplete.then(() => {
      const canvas = this.shadowRoot.getElementById('petal-canvas');
      if (canvas) initPetals(canvas);
    });
  }

  _syncStore() {
    if (!_store || this._unsubscribe) return;
    
    this._unsubscribe = _store.subscribe((state, action) => {
      const wasShowingSettings = this.uiState?.showSettings;

      this.gameState = state.game;
      this.uiState = state.ui;
      this.modifiersState = state.modifiers;
      this.settingsState = state.settings;
      this.multiplayerState = state.multiplayer;
      this.historyState = state.history;

      if (action && action.type === 'GAME/START') {
        _store.registerModifiers(getActiveModifiers(state.modifiers.active));
      }

      if (wasShowingSettings && !state.ui.showSettings) {
        setTimeout(() => {
          const bc = this.shadowRoot.querySelector('board-container');
          const board = bc?.shadowRoot.querySelector('sudoku-board');
          board?.focus();
        }, 50);
      }
    });
    
    const state = _store.getState();
    this.gameState = state.game;
    this.uiState = state.ui;
    this.modifiersState = state.modifiers;
    this.settingsState = state.settings;
    this.multiplayerState = state.multiplayer;
    this.historyState = state.history;
    
    if (this.gameState.cells && this.gameState.cells.length > 0) {
      _store.registerModifiers(getActiveModifiers(this.modifiersState.active));
    }

    if (state.settings.darkMode) {
      document.body.setAttribute('data-theme', 'dark');
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('uiState')) {
      const oldUi = changedProperties.get('uiState');
      if (this.uiState.view === 'GAME' && (!oldUi || oldUi.view !== 'GAME')) {
        setTimeout(() => {
          const bc = this.shadowRoot.querySelector('board-container');
          bc?.focus();
          const board = bc?.shadowRoot.querySelector('sudoku-board');
          board?.focus();
        }, 50);
      }
    }
  }

  _startGame(config = {}) {
    _store.dispatch({
      type: 'GAME/START',
      payload: {
        mode: config.mode || 'STANDARD',
        difficulty: config.difficulty || 'MEDIUM',
        seed: config.seed || null,
        chaos: config.chaos || false,
        modifiers: config.modifiers || [],
        clues: config.clues || null,
        mpMode: config.mpMode || null
      }
    });
    _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'GAME' } });
  }

  _hostGame() {
    this._pendingFlow = 'host';
  }

  _joinGame() {
    this._pendingFlow = 'join';
  }

  _cancelForm() {
    this._pendingFlow = null;
  }

  async _submitForm(e) {
    e.preventDefault();
    const form = e.target;
    const name = form.elements['playerName'].value.trim();
    if (!name) return;
    _store.dispatch({ type: 'MP/SET_PLAYER_NAME', payload: { name } });
    if (this._pendingFlow === 'host') {
      await createRoom(name, 'CO_OP', { difficulty: 'MEDIUM' });
      _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'LOBBY' } });
    } else if (this._pendingFlow === 'join') {
      const code = form.elements['roomCode'].value.trim();
      if (!code) return;
      await joinRoom(code, name);
      _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'LOBBY' } });
    }
    this._pendingFlow = null;
  }

  _onDispatchAction(e) {
    if (_store) _store.dispatch(e.detail);
  }

  _formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  _renderCurrentView() {
    const { view } = this.uiState;

    const menuBtn = (label, onClick) => html`
      <button @click="${onClick}" style="
        width:100%;padding:10px 16px;
        font-family:var(--font-display);font-size:14px;font-style:italic;
        color:var(--text-primary);text-align:left;
        background:var(--chip-bg);
        border:none;border-radius:var(--radius-chip);cursor:pointer;
        box-shadow:var(--chip-shadow);
        transition:all 0.15s;
      ">${label}</button>`;

    if (view === 'LOADING') {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <div style="font-family:var(--font-display);color:var(--text-secondary);font-style:italic;">Loading…</div>
        </div>`;
    }

    if (view === 'MENU') {
      return html`
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;">
          <div style="
            background:var(--glass-bg);
            backdrop-filter:blur(12px);
            -webkit-backdrop-filter:blur(12px);
            border:1px solid var(--glass-border);
            border-radius:var(--radius-lg);
            padding:32px 28px;
            box-shadow:var(--glass-shadow);
            min-width:260px;
            display:flex;flex-direction:column;gap:8px;
          ">
            <div style="font-family:var(--font-display);font-size:26px;font-weight:500;color:var(--text-primary);line-height:1;">Sudokus</div>
            <div style="font-family:var(--font-display);font-style:italic;font-size:14px;color:var(--text-accent);margin-top:-2px;margin-bottom:16px;">by Abe</div>
            ${this._pendingFlow ? html`
              <form class="mp-form" @submit="${this._submitForm}">
                <input name="playerName" placeholder="Your name" required autocomplete="off" .value="${this.multiplayerState?.playerName || ''}" style="
                  padding:8px 10px;border-radius:var(--radius-chip);
                  border:1px solid var(--glass-border);
                  background:var(--glass-bg);color:var(--text-primary);
                  font-family:var(--font-ui);font-size:13px;width:100%;box-sizing:border-box;
                ">
                ${this._pendingFlow === 'join' ? html`
                  <input name="roomCode" placeholder="Room code" required autocomplete="off" style="
                    padding:8px 10px;border-radius:var(--radius-chip);
                    border:1px solid var(--glass-border);
                    background:var(--glass-bg);color:var(--text-primary);
                    font-family:var(--font-ui);font-size:13px;width:100%;box-sizing:border-box;
                  ">
                ` : ''}
                <div class="form-actions" style="display:flex;justify-content:space-between;gap:8px;margin-top:4px;">
                  ${menuBtn('Cancel', this._cancelForm)}
                  <button type="submit" style="
                    width:100%;padding:10px 16px;
                    font-family:var(--font-display);font-size:14px;font-style:italic;
                    color:var(--text-primary);text-align:left;
                    background:var(--chip-bg);
                    border:none;border-radius:var(--radius-chip);cursor:pointer;
                    box-shadow:var(--chip-shadow);
                    transition:all 0.15s;
                  ">${this._pendingFlow === 'host' ? 'Host Game' : 'Join Game'}</button>
                </div>
              </form>
            ` : html`
              <div style="font-family:var(--font-display);font-style:italic;font-size:13px;color:var(--text-accent);margin-bottom:4px;">Try something different today</div>
              ${menuBtn('Quick Play', () => this._startGame())}
              ${menuBtn('Reconstruction', () => this._startGame({ mode: 'RECONSTRUCTION' }))}
              ${menuBtn('Host Multiplayer', this._hostGame)}
              ${menuBtn('Join Multiplayer', this._joinGame)}
            `}
          </div>
        </div>
      `;
    }

    if (view === 'LOBBY') {
      return html`
        <div style="width:100%;">
          <mp-lobby
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .multiplayerState="${this.multiplayerState}"
            .settingsState="${this.settingsState}"
            @dispatch-action="${this._onDispatchAction}"
          ></mp-lobby>
        </div>
      `;
    }

    if (view === 'GAME') {
      return html`
        <div style="width:100%;display:flex;flex-direction:column;align-items:center;">
          ${this.multiplayerState?.status === 'PLAYING' ? html`
            <div style="padding:0.5rem 0;">
              <mp-player-list
                compact
                .peers="${this.multiplayerState.peers}"
                .localPeerId="${this.multiplayerState.peerId}"
              ></mp-player-list>
            </div>
          ` : ''}
          <board-container
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .modifiers="${this.modifiersState}"
            .settingsState="${this.settingsState}"
            .multiplayerState="${this.multiplayerState}"
            .historyState="${this.historyState}"
            @dispatch-action="${this._onDispatchAction}"
          ></board-container>
        </div>
        ${this.uiState?.showWinModal ? html`
          <result-screen
            .gameState="${this.gameState}"
            .uiState="${this.uiState}"
            .multiplayerState="${this.multiplayerState}"
            .settingsState="${this.settingsState}"
            @dispatch-action="${this._onDispatchAction}"
          ></result-screen>
        ` : ''}
      `;
    }

    return html`<div>Unknown View</div>`;
  }

  render() {
    return html`
      <canvas id="petal-canvas" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;"></canvas>
      <div style="position:relative;z-index:1;width:100%;">
        ${this._renderCurrentView()}
      </div>
      ${this.uiState?.showSettings ? html`
        <settings-modal
          .settingsState="${this.settingsState}"
          .uiState="${this.uiState}"
          @dispatch-action="${this._onDispatchAction}"
        ></settings-modal>
      ` : ''}
      ${this.uiState?.viewingSolution ? html`
        <div style="position:fixed;bottom:32px;left:50%;transform:translateX(-50%);z-index:50;">
          <button @click="${() => this._onDispatchAction({ detail: { type: 'UI/SHOW_WIN_MODAL' } })}" style="
            padding:10px 24px;
            font-family:var(--font-display);font-style:italic;font-size:14px;
            color:var(--text-primary);
            background:var(--glass-bg);
            backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
            border:1px solid var(--glass-border);
            border-radius:var(--radius-pill);
            box-shadow:var(--glass-shadow);
            cursor:pointer;white-space:nowrap;transition:all 0.2s;
          ">← Back to results</button>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('app-root', AppRoot);
