import { LitElement, html, css } from 'https://esm.sh/lit@3';

export class SettingsModal extends LitElement {
  static properties = {
    settingsState: { type: Object },
    uiState: { type: Object }
  };

  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(60, 40, 20, 0.35);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 200;
    }

    @keyframes fade-in {
      0%   { opacity: 0; transform: scale(0.96); }
      100% { opacity: 1; transform: scale(1); }
    }

    .modal {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 32px 36px;
      box-shadow: var(--glass-shadow);
      min-width: 320px;
      max-width: 420px;
      width: 90vw;
      animation: fade-in 0.2s ease-out forwards;
    }

    .modal-title {
      font-family: var(--font-display);
      font-size: 22px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .modal-subtitle {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-accent);
      margin-bottom: 24px;
    }

    .section-label {
      font-size: 9px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 500;
      margin-bottom: 8px;
      margin-top: 16px;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(180, 130, 90, 0.1);
    }

    .setting-row:last-of-type {
      border-bottom: none;
    }

    .setting-label {
      font-family: var(--font-ui);
      font-size: 14px;
      color: var(--text-primary);
    }

    .setting-desc {
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .toggle {
      width: 36px;
      height: 20px;
      border-radius: 10px;
      background: rgba(180, 130, 90, 0.25);
      border: 1px solid rgba(180, 130, 90, 0.3);
      position: relative;
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toggle.on {
      background: rgba(208, 104, 64, 0.6);
      border-color: rgba(190, 90, 55, 0.5);
    }

    .toggle-thumb {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #fdf5ee;
      position: absolute;
      top: 2px;
      left: 2px;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      pointer-events: none;
    }

    .toggle.on .toggle-thumb {
      transform: translateX(16px);
    }

    .close-btn {
      width: 100%;
      margin-top: 24px;
      height: 40px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-primary);
      background: var(--chip-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }

    .close-btn:hover {
      background: var(--chip-bg-hover);
      box-shadow: var(--chip-shadow-hover);
    }
  `;

  constructor() {
    super();
    this.addEventListener('click', () => this._close());
  }

  _row(label, key, value, desc) {
    return html`
      <div class="setting-row">
        <div>
          <div class="setting-label">${label}</div>
          ${desc ? html`<div class="setting-desc">${desc}</div>` : ''}
        </div>
        <div
          class="toggle ${value ? 'on' : ''}"
          @mousedown="${e => e.preventDefault()}"
          @click="${(e) => { e.stopPropagation(); this._toggle(key, value); }}"
        >
          <div class="toggle-thumb"></div>
        </div>
      </div>
    `;
  }

  _toggle(key, currentValue) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'SETTINGS/SET', payload: { key, value: !currentValue } },
      bubbles: true,
      composed: true
    }));
    if (key === 'darkMode') {
      document.body.setAttribute('data-theme', !currentValue ? 'dark' : '');
    }
  }

  _close() {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: { type: 'UI/CLOSE_SETTINGS' },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    const s = this.settingsState;
    return html`
      <div class="modal" @click="${e => e.stopPropagation()}">
        <div class="modal-title">Settings</div>
        <div class="modal-subtitle">Make it yours</div>

        <div class="section-label">Appearance</div>
        ${this._row('Dark mode', 'darkMode', s?.darkMode, 'Easy on the eyes at night')}
        ${this._row('Region colors', 'regionColors', s?.regionColors, 'Tint the 3×3 boxes softly')}

        <div class="section-label">Gameplay</div>
        ${this._row('Highlight peers', 'highlightPeers', s?.highlightPeers, 'Show row, column and box on selection')}
        ${this._row('Show timer', 'showTimer', s?.showTimer, '')}
        ${this._row('Show mistakes', 'showMistakes', s?.showMistakes, '')}

        <div class="section-label">Multiplayer</div>
        ${this._row('Show player colors', 'showPlayerColors', s?.showPlayerColors, 'Who placed what in co-op')}
        ${this._row('Show opponent board', 'showOpponentBoard', s?.showOpponentBoard, 'Silhouette view in competitive mode')}

        <button class="close-btn" @mousedown="${e => e.preventDefault()}" @click="${() => this._close()}">Done</button>
      </div>
    `;
  }
}

customElements.define('settings-modal', SettingsModal);
