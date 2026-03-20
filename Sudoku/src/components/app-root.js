import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './board-container.js';
import './title-screen.js';
import './mode-select.js';
import './multiplayer-entry.js';
import './progress-screen.js';
import './mp-lobby.js';
import './mp-player-list.js';
import './result-screen.js';
import './challenges-screen.js';
import './settings-modal.js';
import { getActiveModifiers } from '../modifiers/registry.js';
import { createRoom, joinRoom, leaveRoom, isConnected } from '../services/multiplayerClient.js';
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
    statsState: { type: Object },
    achievementsState: { type: Array },
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

    @keyframes overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .lobby-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(40, 28, 16, 0.38);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      animation: overlay-in 0.25s ease forwards;
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
    this.statsState = {};
    this.achievementsState = [];
    this._pendingFlow = null;
    this._fromPopState = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._syncStore();
    // Seed the history stack with the initial view so back never leaves the app
    const initialView = _store?.getState().ui.view || 'TITLE';
    history.replaceState({ view: initialView }, '');
    this._boundPopState = this._handlePopState.bind(this);
    window.addEventListener('popstate', this._boundPopState);
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
      this.statsState = state.stats;
      this.achievementsState = state.achievements;

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
    this.statsState = state.stats;
    this.achievementsState = state.achievements;

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
    window.removeEventListener('popstate', this._boundPopState);
  }

  _leaveMultiplayerIfActive() {
    if (isConnected()) {
      leaveRoom();
      _store.dispatch({ type: 'MP/DISCONNECT' });
    }
  }

  _handlePopState(e) {
    const view = e.state?.view;
    if (view && _store) {
      this._leaveMultiplayerIfActive();
      this._fromPopState = true;
      _store.dispatch({ type: 'UI/SET_VIEW', payload: { view } });
    }
  }

  updated(changedProperties) {
    if (changedProperties.has('uiState')) {
      const oldUi = changedProperties.get('uiState');
      const newView = this.uiState.view;

      if (oldUi && oldUi.view !== newView && newView !== 'LOADING') {
        if (this._fromPopState) {
          this._fromPopState = false;
        } else {
          history.pushState({ view: newView }, '');
        }
      }

      if (newView === 'GAME' && (!oldUi || oldUi.view !== 'GAME')) {
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

  async _onDispatchAction(e) {
    const action = e.detail;
    if (action.type === 'MP/CREATE_ROOM') {
      const { playerName } = action.payload;
      _store.dispatch({ type: 'MP/SET_PLAYER_NAME', payload: { name: playerName } });
      await createRoom(playerName, 'CO_OP', { difficulty: 'MEDIUM' });
      _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'LOBBY' } });
      return;
    }
    if (action.type === 'MP/JOIN_ROOM') {
      const { playerName, roomCode } = action.payload;
      _store.dispatch({ type: 'MP/SET_PLAYER_NAME', payload: { name: playerName } });
      _store.dispatch({ type: 'MP/SET_ERROR', payload: null });
      try {
        await joinRoom(roomCode, playerName);
        _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'LOBBY' } });
      } catch (err) {
        _store.dispatch({ type: 'MP/SET_ERROR', payload: err?.message || 'Room not found' });
      }
      return;
    }
    // Leaving the game view while in a multiplayer session disconnects the player.
    if (action.type === 'UI/SET_VIEW' && action.payload?.view !== 'GAME') {
      const currentView = _store?.getState().ui?.view;
      if (currentView === 'GAME') this._leaveMultiplayerIfActive();
    }
    if (_store) _store.dispatch(action);
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

    if (view === 'TITLE') {
      return html`<title-screen
        .multiplayerState="${this.multiplayerState}"
        @dispatch-action="${this._onDispatchAction}"
      ></title-screen>`;
    }

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
              ${menuBtn('Singleplayer', () => _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'MODE_SELECT' } }))}
              ${menuBtn('Quick Play', () => this._startGame())}
              ${menuBtn('Reconstruction', () => this._startGame({ mode: 'RECONSTRUCTION' }))}
              ${menuBtn('Host Multiplayer', this._hostGame)}
              ${menuBtn('Join Multiplayer', this._joinGame)}
            `}
          </div>
        </div>
      `;
    }

    if (view === 'MODE_SELECT') {
      return html`<mode-select
        .uiState="${this.uiState}"
        .settingsState="${this.settingsState}"
        @dispatch-action="${this._onDispatchAction}"
      ></mode-select>`;
    }

    if (view === 'CHALLENGES') {
      return html`<challenges-screen
        .statsState="${this.statsState}"
        .settingsState="${this.settingsState}"
        .achievementsState="${this.achievementsState}"
        @dispatch-action="${this._onDispatchAction}"
      ></challenges-screen>`;
    }

    if (view === 'ACHIEVEMENTS' || view === 'STATS') {
      return html`<progress-screen
        .uiState="${this.uiState}"
        .settingsState="${this.settingsState}"
        .statsState="${this.statsState}"
        .achievementsState="${this.achievementsState}"
        @dispatch-action="${this._onDispatchAction}"
      ></progress-screen>`;
    }

    if (view === 'MULTIPLAYER') {
      return html`<multiplayer-entry
        .multiplayerState="${this.multiplayerState}"
        .settingsState="${this.settingsState}"
        @dispatch-action="${this._onDispatchAction}"
      ></multiplayer-entry>`;
    }

    if (view === 'LOBBY') {
      return html`
        <div style="position:relative;width:100%;min-height:100vh;">
          <multiplayer-entry
            .multiplayerState="${this.multiplayerState}"
            .settingsState="${this.settingsState}"
            @dispatch-action="${this._onDispatchAction}"
          ></multiplayer-entry>
          <div class="lobby-overlay">
            <mp-lobby
              .gameState="${this.gameState}"
              .uiState="${this.uiState}"
              .multiplayerState="${this.multiplayerState}"
              .settingsState="${this.settingsState}"
              @dispatch-action="${this._onDispatchAction}"
            ></mp-lobby>
          </div>
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
      ${this.uiState?.loading ? html`
        <div style="position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);">
          <div style="font-family:var(--font-display);font-style:italic;font-size:18px;color:#fff;letter-spacing:0.02em;">Preparing your puzzle…</div>
        </div>
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
