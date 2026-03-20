import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { initPetals } from '../utils/petals.js';

export class MultiplayerEntry extends LitElement {
  static properties = {
    multiplayerState: { type: Object },
    settingsState: { type: Object }
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100vh;
      position: relative;
      overflow: hidden;
      background: var(--bg-gradient);
      font-family: var(--font-ui);
    }

    .petals-layer {
      position: absolute;
      inset: 0;
      z-index: 0;
      pointer-events: none;
    }

    .ui {
      position: absolute;
      inset: 0;
      z-index: 1;
      display: flex;
      flex-direction: column;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 32px 8px;
    }

    .back-btn {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-secondary);
      cursor: pointer;
      background: none;
      border: none;
      transition: color 0.2s;
      padding: 0;
    }
    .back-btn:hover { color: var(--text-primary); }

    .top-title {
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    /* ── Main content ───────────────────────────────────── */

    .content {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .sections {
      display: flex;
      flex-direction: column;
      width: min(88vw, 360px);
    }

    /* ── Section ────────────────────────────────────────── */

    @keyframes section-in {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .section {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 32px 0;
      animation: section-in 0.4s ease both;
    }

    .section:first-child { animation-delay: 0.05s; }
    .section:last-child  { animation-delay: 0.18s; }

    .divider {
      animation: section-in 0.4s ease 0.12s both;
    }

    .section-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .section-desc {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.55;
      margin-top: -6px;
    }

    .divider {
      height: 1px;
      background: var(--glass-border);
    }

    /* ── Code input ─────────────────────────────────────── */

    .code-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    input {
      background: var(--code-input-bg);
      border: 1px solid var(--code-input-border);
      border-radius: var(--radius-chip);
      padding: 9px 13px;
      font-family: var(--font-numbers);
      font-size: 18px;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--code-input-color);
      outline: none;
      width: 140px;
      box-sizing: border-box;
      transition: border-color 0.2s;
    }
    input::placeholder {
      color: var(--code-input-placeholder);
      font-size: 14px;
      letter-spacing: 0.04em;
      text-transform: none;
    }
    input:focus { border-color: var(--code-input-border-focus); }

    .join-error {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 12px;
      color: #b03020;
      margin-top: -6px;
    }

    /* ── Buttons ────────────────────────────────────────── */

    .action-btn {
      padding: 10px 22px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 15px;
      color: var(--chip-color);
      background: var(--chip-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
      white-space: nowrap;
      align-self: flex-start;
    }
    .action-btn:hover {
      box-shadow: var(--chip-shadow-hover);
      transform: translateY(-1px);
    }
    .action-btn:active {
      box-shadow: var(--chip-shadow-active);
      transform: scale(0.98);
    }
    .action-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      box-shadow: var(--chip-shadow);
    }

    /* ── How-to modal overlay ───────────────────────────── */

    .modal-overlay {
      position: absolute;
      inset: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(40, 28, 16, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.22s ease;
    }
    .modal-overlay.visible {
      opacity: 1;
      pointer-events: auto;
    }

    .modal {
      background: var(--modal-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 32px 36px;
      box-shadow: var(--shadow-modal);
      max-width: 380px;
      width: calc(100% - 48px);
      box-sizing: border-box;
    }

    .modal h2 {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0 0 16px;
    }

    .modal ol {
      margin: 0 0 20px;
      padding-left: 20px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .modal li {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .modal li strong {
      font-style: normal;
      font-weight: 600;
      color: var(--text-primary);
    }

    .modal-close {
      display: block;
      width: 100%;
      padding: 10px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--chip-color);
      background: var(--chip-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }
    .modal-close:hover { box-shadow: var(--chip-shadow-hover); }
  `;

  constructor() {
    super();
    this._codeValue = '';
    this._showHowTo = false;
  }

  firstUpdated() {
    const canvas = this.shadowRoot.getElementById('petal-canvas');
    if (canvas) initPetals(canvas);
  }

  _dispatch(action) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: action, bubbles: true, composed: true
    }));
  }

  _onBack() {
    this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } });
  }

  _onHost() {
    const playerName = this.multiplayerState?.playerName || 'Player';
    this._dispatch({ type: 'MP/CREATE_ROOM', payload: { playerName } });
  }

  _onJoin() {
    if (this._codeValue.length < 6) return;
    const playerName = this.multiplayerState?.playerName || 'Player';
    this._dispatch({
      type: 'MP/JOIN_ROOM',
      payload: { playerName, roomCode: this._codeValue.toUpperCase() }
    });
  }

  _onCodeInput(e) {
    this._codeValue = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
    e.target.value = this._codeValue;
    if (this.multiplayerState?.error) {
      this._dispatch({ type: 'MP/SET_ERROR', payload: null });
    }
    this.requestUpdate();
  }

  _onCodeKeydown(e) {
    if (e.key === 'Enter' && this._codeValue.length === 6) this._onJoin();
  }

  _openHowTo() {
    this._showHowTo = true;
    this.requestUpdate();
  }

  _closeHowTo() {
    this._showHowTo = false;
    this.requestUpdate();
  }

  render() {
    return html`
      <div class="petals-layer">
        <canvas id="petal-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
      </div>

      <div class="ui">
        <div class="topbar">
          <button class="back-btn" @click="${this._onBack}">← Back</button>
          <div class="top-title">Multiplayer</div>
          <div style="width:60px"></div>
        </div>

        <div class="content">
          <div class="sections">

            <!-- Host -->
            <div class="section">
              <div class="section-title">Host</div>
              <div class="section-desc">Create a room and share the code with friends.</div>
              <button class="action-btn" @click="${this._onHost}">Create Room →</button>
            </div>

            <div class="divider"></div>

            <!-- Join -->
            <div class="section">
              <div class="section-title">Join</div>
              <div class="section-desc">Enter a 6-character room code to jump in.</div>
              <div class="code-row">
                <input
                  type="text"
                  placeholder="Room code"
                  maxlength="6"
                  autocomplete="off"
                  spellcheck="false"
                  @input="${this._onCodeInput}"
                  @keydown="${this._onCodeKeydown}"
                >
                <button
                  class="action-btn"
                  ?disabled="${this._codeValue.length < 6}"
                  @click="${this._onJoin}"
                >Join →</button>
              </div>
              ${this.multiplayerState?.error ? html`
                <div class="join-error">${this.multiplayerState.error}</div>
              ` : ''}
              <button class="action-btn" style="background:none;box-shadow:none;color:var(--text-muted);font-size:12px;padding:0;align-self:flex-start;" @click="${this._openHowTo}">How does this work?</button>
            </div>

          </div>
        </div>
      </div>

      <!-- How-to modal -->
      <div
        class="modal-overlay ${this._showHowTo ? 'visible' : ''}"
        @click="${e => { if (e.target === e.currentTarget) this._closeHowTo(); }}"
      >
        <div class="modal">
          <h2>How Multiplayer Works</h2>
          <ol>
            <li><strong>Host</strong> creates a room and receives a 6-character code.</li>
            <li><strong>Share</strong> the code with everyone you want to play with.</li>
            <li><strong>Guests</strong> enter the code to join the lobby.</li>
            <li>The host picks the <strong>game mode and difficulty</strong>, then starts when everyone is ready.</li>
            <li>Play together in <strong>Co-op</strong> (shared board) or race in <strong>Competitive</strong> mode.</li>
          </ol>
          <button class="modal-close" @click="${this._closeHowTo}">Got it</button>
        </div>
      </div>
    `;
  }
}

customElements.define('multiplayer-entry', MultiplayerEntry);
