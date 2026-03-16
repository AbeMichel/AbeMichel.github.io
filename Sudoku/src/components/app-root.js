import { LitElement, html, css } from 'https://esm.sh/lit@3';
import './board-container.js';
import { getActiveModifiers } from '../modifiers/registry.js';

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
    settingsState: { type: Object }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      width: 100%;
      background-color: var(--bg-color, #f5f5f5);
      font-family: system-ui, sans-serif;
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
  `;

  constructor() {
    super();
    this.gameState = {};
    this.uiState = {};
    this.modifiersState = {};
    this.settingsState = {};
  }

  connectedCallback() {
    super.connectedCallback();
    this._syncStore();
  }

  _syncStore() {
    if (!_store || this._unsubscribe) return;
    
    this._unsubscribe = _store.subscribe((state, action) => {
      this.gameState = state.game;
      this.uiState = state.ui;
      this.modifiersState = state.modifiers;
      this.settingsState = state.settings;

      if (action && action.type === 'GAME/START') {
        _store.registerModifiers(getActiveModifiers(state.modifiers.active));
      }
    });
    
    const state = _store.getState();
    this.gameState = state.game;
    this.uiState = state.ui;
    this.modifiersState = state.modifiers;
    this.settingsState = state.settings;
    
    if (this.gameState.cells && this.gameState.cells.length > 0) {
      _store.registerModifiers(getActiveModifiers(this.modifiersState.active));
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
          const container = this.shadowRoot.querySelector('board-container');
          if (container) container.focus();
        }, 0);
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
        clues: config.clues || null
      }
    });
    _store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'GAME' } });
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

  render() {
    const { view } = this.uiState;

    if (view === 'LOADING') {
      return html`<div>Loading Sudoku...</div>`;
    }

    if (view === 'MENU') {
      return html`
        <div class="menu-placeholder">
          <h1>Sudoku</h1>
          <p>Menu placeholder</p>
          <button @click="${() => this._startGame()}">
            Start Standard
          </button>
          <button @click="${() => this._startGame({ mode: 'RECONSTRUCTION' })}">
            Start Reconstruction
          </button>
        </div>
      `;
    }

    if (view === 'GAME') {
      return html`
        <div class="hud">
          <span>Time: ${this._formatTime(this.gameState.timer)}</span>
          <span>Mistakes: ${this.gameState.mistakes}</span>
        </div>
        <board-container 
          .gameState="${this.gameState}"
          .uiState="${this.uiState}"
          .modifiers="${this.modifiersState}"
          .settingsState="${this.settingsState}"
          @dispatch-action="${this._onDispatchAction}"
        ></board-container>
      `;
    }

    return html`<div>Unknown View</div>`;
  }
}

customElements.define('app-root', AppRoot);
