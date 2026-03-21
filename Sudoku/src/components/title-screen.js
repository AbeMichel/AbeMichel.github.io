import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { initPetals } from '../utils/petals.js';

export class TitleScreen extends LitElement {
  static properties = {
    multiplayerState: { type: Object },
    gameState: { type: Object },
    _showResumeModal: { type: Boolean, state: true }
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-gradient);
      font-family: var(--font-ui);
      position: relative;
    }

    .petals-layer {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }

    .scene {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .title-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 64px;
      animation: fadein 1.2s ease forwards;
    }

    @keyframes fadein {
      from { opacity: 0; transform: translateY(-8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .title-main {
      font-family: var(--font-display);
      font-size: var(--title-size);
      font-weight: 500;
      color: var(--text-primary);
      letter-spacing: 0.01em;
      line-height: 1;
      text-shadow: 0 2px 12px rgba(255,255,255,0.3);
    }

    .title-sub {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 22px;
      color: var(--text-accent);
      letter-spacing: 0.04em;
      margin-top: 4px;
      text-align: center;
    }

    .menu {
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: fadein 1.4s ease 0.3s both;
    }

    .menu-item {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 6px 0;
    }

    .arrow {
      font-family: var(--font-display);
      font-size: var(--menu-item-size);
      color: var(--menu-arrow-color);
      opacity: 0;
      transform: translateX(-12px);
      transition: opacity 0.2s ease, transform 0.2s ease;
      width: 24px;
      flex-shrink: 0;
    }

    .item-text {
      font-family: var(--font-display);
      font-size: var(--menu-item-size);
      font-weight: 400;
      color: var(--menu-item-color);
      transition: color 0.2s ease, transform 0.2s ease;
      letter-spacing: 0.02em;
    }

    .menu-item:hover .arrow {
      opacity: 1;
      transform: translateX(0);
    }
    .menu-item:hover .item-text {
      color: var(--menu-item-hover);
      transform: translateX(6px);
    }

    .flavor {
      position: absolute;
      bottom: 28px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-muted);
      animation: fadein 1.6s ease 0.6s both;
    }

    /* ── Name tag (top-left) ───────────────────────────── */

    .name-tag {
      position: absolute;
      top: 20px;
      left: 28px;
      cursor: pointer;
      animation: fadein 1s ease 0.2s both;
    }

    .name-tag-text {
      font-family: var(--font-display);
      font-size: 15px;
      font-weight: 500;
      color: var(--text-secondary);
      transition: color 0.2s;
      line-height: 1.2;
    }

    .name-tag:hover .name-tag-text {
      color: var(--text-primary);
    }

    .name-tag-hint {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 11px;
      color: var(--text-muted);
      opacity: 0.7;
      margin-top: 2px;
      transition: opacity 0.2s;
    }

    .name-tag:hover .name-tag-hint {
      opacity: 1;
    }

    /* ── Inline name edit ──────────────────────────────── */

    .name-edit {
      position: absolute;
      top: 16px;
      left: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadein 0.18s ease forwards;
    }

    .name-input {
      background: var(--code-input-bg);
      border: 1px solid var(--code-input-border);
      border-radius: var(--radius-chip);
      padding: 6px 10px;
      font-family: var(--font-display);
      font-size: 14px;
      color: var(--code-input-color);
      outline: none;
      width: 160px;
      transition: border-color 0.2s;
    }
    .name-input:focus { border-color: var(--code-input-border-focus); }
    .name-input::placeholder { color: var(--code-input-placeholder); }

    .name-confirm {
      padding: 6px 14px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--chip-color);
      background: var(--chip-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .name-confirm:hover { box-shadow: var(--chip-shadow-hover); }

    /* ── First-time name prompt overlay ───────────────── */

    .welcome-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(40, 28, 16, 0.38);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
      animation: fadein 0.4s ease forwards;
    }

    .welcome-card {
      background: var(--modal-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 36px 40px 30px;
      box-shadow: var(--shadow-modal);
      width: min(88vw, 340px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 20px;
      animation: fadein 0.35s ease 0.05s both;
    }

    .welcome-title {
      font-family: var(--font-display);
      font-size: 24px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
    }

    .welcome-desc {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.55;
      margin: -10px 0 0;
    }

    .welcome-input {
      background: var(--code-input-bg);
      border: 1px solid var(--code-input-border);
      border-radius: var(--radius-chip);
      padding: 10px 14px;
      font-family: var(--font-display);
      font-size: 15px;
      color: var(--code-input-color);
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .welcome-input:focus { border-color: var(--code-input-border-focus); }
    .welcome-input::placeholder { color: var(--code-input-placeholder); }

    .welcome-btn {
      padding: 11px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 15px;
      color: var(--chip-active-color);
      background: var(--chip-active-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
      width: 100%;
    }
    .welcome-btn:hover { box-shadow: var(--chip-shadow-hover); transform: translateY(-1px); }
    .welcome-btn:active { transform: scale(0.98); }
    .welcome-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
  `;

  constructor() {
    super();
    this.multiplayerState = null;
    this.gameState = null;
    this._editing = false;
    this._showResumeModal = false;
    this._editValue = '';
    this._welcomeValue = '';
    this._items = [
      { label: 'Singleplayer',  action: () => this._handleSingleplayer() },
      { label: 'Multiplayer',   action: () => this._go('MULTIPLAYER') },
      { label: 'Challenges',   action: () => this._go('CHALLENGES') },
      { label: 'Achievements',  action: () => this._go('ACHIEVEMENTS') },
      { label: 'Settings',      action: () => this._dispatch({ type: 'UI/OPEN_SETTINGS' }) },
    ];
  }

  _handleSingleplayer() {
    const hasProgress = this.gameState?.cells?.some(c => !c.fixed && c.v > 0);
    const isPlaying = this.gameState?.status === 'PLAYING';
    
    if (isPlaying && hasProgress) {
      this._showResumeModal = true;
    } else {
      this._go('MODE_SELECT');
    }
  }

  firstUpdated() {
    const canvas = this.shadowRoot.getElementById('petal-canvas');
    if (canvas) initPetals(canvas);
    // Auto-focus welcome input for first-time visitors
    this.updateComplete.then(() => {
      this.shadowRoot.querySelector('.welcome-input')?.focus();
    });
  }

  _go(view) {
    this._showResumeModal = false;
    this._dispatch({ type: 'UI/SET_VIEW', payload: { view } });
  }

  _dispatch(action) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: action, bubbles: true, composed: true
    }));
  }

  _saveName(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    this._dispatch({ type: 'MP/SET_PLAYER_NAME', payload: { name: trimmed } });
  }

  // ── Welcome prompt handlers ───────────────────────────

  _onWelcomeInput(e) {
    this._welcomeValue = e.target.value;
    this.requestUpdate();
  }

  _onWelcomeKeydown(e) {
    if (e.key === 'Enter') this._confirmWelcome();
  }

  _confirmWelcome() {
    this._saveName(this._welcomeValue);
    this._welcomeValue = '';
  }

  // ── Inline edit handlers ──────────────────────────────

  _startEdit() {
    this._editValue = this.multiplayerState?.playerName || '';
    this._editing = true;
    this.requestUpdate();
    this.updateComplete.then(() => {
      this.shadowRoot.querySelector('.name-input')?.focus();
    });
  }

  _onEditInput(e) {
    this._editValue = e.target.value;
  }

  _onEditKeydown(e) {
    if (e.key === 'Enter') this._confirmEdit();
    if (e.key === 'Escape') { this._editing = false; this.requestUpdate(); }
  }

  _onEditBlur() {
    // slight delay so the confirm button click fires first
    setTimeout(() => {
      if (this._editing) { this._editing = false; this.requestUpdate(); }
    }, 150);
  }

  _confirmEdit() {
    this._saveName(this._editValue);
    this._editing = false;
    this.requestUpdate();
  }

  _formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  _getCompletionPercentage() {
    if (!this.gameState?.cells) return 0;
    const nonFixed = this.gameState.cells.filter(c => !c.fixed);
    if (nonFixed.length === 0) return 0;
    const filled = nonFixed.filter(c => c.v > 0).length;
    return Math.floor((filled / nonFixed.length) * 100);
  }

  render() {
    const playerName = this.multiplayerState?.playerName || '';
    const firstTime = !playerName;

    return html`
      <div class="petals-layer">
        <canvas id="petal-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
      </div>

      <div class="scene">

        ${playerName
          ? this._editing
            ? html`
              <div class="name-edit">
                <input
                  class="name-input"
                  type="text"
                  placeholder="Your name…"
                  maxlength="20"
                  autocomplete="off"
                  .value="${this._editValue}"
                  @input="${this._onEditInput}"
                  @keydown="${this._onEditKeydown}"
                  @blur="${this._onEditBlur}"
                >
                <button class="name-confirm" @mousedown="${e => e.preventDefault()}" @click="${this._confirmEdit}">Save</button>
              </div>`
            : html`
              <div class="name-tag" @click="${this._startEdit}">
                <div class="name-tag-text">${playerName}</div>
                <div class="name-tag-hint">Click to change</div>
              </div>`
          : ''}

        <div class="title-block">
          <div class="title-main">Sudokus</div>
          <div class="title-sub">by Abe</div>
        </div>
        <div class="menu">
          ${this._items.map(item => html`
            <div class="menu-item" @click="${item.action}">
              <div class="arrow">›</div>
              <div class="item-text">${item.label}</div>
            </div>
          `)}
        </div>
        <div class="flavor">Try something different today</div>
      </div>

      ${firstTime ? html`
        <div class="welcome-overlay">
          <div class="welcome-card">
            <div class="welcome-title">Welcome</div>
            <div class="welcome-desc">What should we call you? This name is used in multiplayer.</div>
            <input
              class="welcome-input"
              type="text"
              placeholder="Your name…"
              maxlength="20"
              autocomplete="off"
              .value="${this._welcomeValue}"
              @input="${this._onWelcomeInput}"
              @keydown="${this._onWelcomeKeydown}"
            >
            <button
              class="welcome-btn"
              ?disabled="${!this._welcomeValue.trim()}"
              @click="${this._confirmWelcome}"
            >Let's go →</button>
          </div>
        </div>
      ` : ''}

      ${this._showResumeModal ? html`
        <div class="welcome-overlay">
          <div class="welcome-card" style="gap: 16px;">
            <div class="welcome-title">Resume Puzzle?</div>
            <div class="welcome-desc">You have an unfinished game in progress.</div>
            
            <div style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; font-size: 14px; color: var(--text-secondary);">
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Mode:</span>
                <span style="color:var(--text-primary); font-weight:500;">${this.gameState.mode}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Difficulty:</span>
                <span style="color:var(--text-primary); font-weight:500;">${this.gameState.difficulty}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                <span>Time:</span>
                <span style="color:var(--text-primary); font-weight:500;">${this._formatTime(this.gameState.timer)}</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span>Filled:</span>
                <span style="color:var(--text-primary); font-weight:500;">${this._getCompletionPercentage()}%</span>
              </div>
            </div>

            <button class="welcome-btn" @click="${() => this._go('GAME')}">Continue Puzzle</button>
            <button class="welcome-btn" style="background:var(--glass-bg); color:var(--text-primary);" @click="${() => this._go('MODE_SELECT')}">New Game</button>
            <button class="welcome-btn" style="background:transparent; color:var(--text-muted); box-shadow:none; padding: 4px;" @click="${() => this._showResumeModal = false}">Cancel</button>
          </div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('title-screen', TitleScreen);
