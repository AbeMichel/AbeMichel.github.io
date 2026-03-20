import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { initPetals } from '../utils/petals.js';

const difficulties = [
  { value: 'VERY_EASY', label: 'Very Easy' },
  { value: 'EASY',      label: 'Easy' },
  { value: 'MEDIUM',    label: 'Medium' },
  { value: 'HARD',      label: 'Hard' },
  { value: 'VERY_HARD', label: 'Very Hard' }
];

const ascLabels = [
  'Standard rules', 'No candidate marks', 'Timer counts down',
  'Mistakes are final', 'No hints allowed', 'Candidates hidden',
  'Fragile: errors reset', 'Ordered entry only', 'Decaying candidates',
  'Living puzzle', 'Chaos regions', 'Maximum difficulty',
  'True ascension', 'Beyond madness', 'Enlightened chaos',
  'The void awaits', 'Absolute', 'Transcendent', 'Legendary', 'Mythic'
];

export class ModeSelect extends LitElement {
  static properties = {
    uiState: { type: Object },
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

    .preview {
      position: absolute;
      right: 0;
      bottom: 0;
      width: 66vw;
      height: 67vh;
      border-radius: var(--radius-md) 0 0 0;
      box-shadow: var(--shadow-board);
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.5s ease, transform 0.5s ease;
      overflow: hidden;
    }
    .preview.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .preview::after {
      content: '';
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 60%;
      background: linear-gradient(to bottom, transparent, var(--preview-fade));
      z-index: 1;
      pointer-events: none;
    }
    .preview-inner {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-muted);
      transition: background 0.4s ease;
    }

    .ui {
      position: absolute;
      inset: 0;
      z-index: 2;
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
    }
    .back-btn:hover { color: var(--text-primary); }
    .top-title {
      font-size: 10px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .content { flex: 1; position: relative; }

    .left-panel {
      position: absolute;
      left: 32px;
      top: 110px;
      width: 250px;
      opacity: 0;
      transform: translateX(-14px);
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .left-panel.visible {
      opacity: 1;
      transform: translateX(0);
    }
    .mode-title {
      font-family: var(--font-display);
      font-size: 46px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.05;
      text-shadow: 0 2px 6px rgba(255,255,255,0.25);
    }
    .mode-desc {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-mode-desc);
      margin-top: 8px;
      line-height: 1.6;
      max-width: 220px;
      white-space: pre-line;
    }

    .controls { margin-top: 20px; display: flex; flex-direction: column; gap: 16px; }

    .ctl-label {
      font-size: 9px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 5px;
    }

    .diff-select {
      appearance: none;
      -webkit-appearance: none;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: 8px 36px 8px 14px;
      font-family: var(--font-display);
      font-size: 14px;
      color: var(--text-primary);
      cursor: pointer;
      outline: none;
      width: 100%;
      box-shadow: var(--shadow-hud);
    }

    .asc-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 5px;
    }
    .asc-btn {
      width: 28px; height: 28px;
      border-radius: var(--radius-circle);
      border: 1px solid var(--glass-border);
      background: var(--hud-btn-bg);
      color: var(--text-primary);
      font-size: 17px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      box-shadow: var(--shadow-hud);
    }
    .asc-btn:hover { background: rgba(208,104,64,0.22); }
    .asc-num {
      font-family: var(--font-display);
      font-size: 20px;
      color: var(--text-primary);
      min-width: 36px;
      text-align: center;
    }
    .asc-sub {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 11px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .begin-btn {
      position: absolute;
      right: 32px;
      bottom: 8px;
      z-index: 1;
      padding: 11px 34px;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 15px;
      color: var(--chip-active-color);
      background: var(--chip-active-bg);
      border: none;
      border-radius: var(--radius-chip);
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      opacity: 0;
      pointer-events: none;
      transform: translateY(6px);
      transition: opacity 0.3s ease 0.15s, transform 0.3s ease 0.15s;
    }
    .begin-btn.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .begin-btn:hover {
      box-shadow: var(--chip-shadow-hover);
      transform: translateY(-2px);
    }

    .cards-row {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      gap: 16px;
      padding: 0 24px 24px;
    }
    .mode-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      cursor: pointer;
      gap: 10px;
    }
    .stone {
      width: 110px; height: 110px;
      border-radius: var(--radius-md);
      background: var(--chip-bg);
      border: 1px solid rgba(90,75,55,0.25);
      box-shadow: var(--chip-shadow);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }
    .stone::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
      opacity: 0;
      transition: opacity 0.25s;
    }
    .mode-card.active .stone::before { opacity: 1; }
    .mode-card:not(.active):hover .stone {
      background: var(--chip-bg-hover);
      box-shadow: var(--chip-shadow-hover);
    }

    .mode-card.active[data-mode="STANDARD"] .stone {
      background: var(--mode-classic-bg);
      border-color: var(--mode-classic-border);
      box-shadow: 0 6px 22px var(--mode-classic-glow),
                  inset 0 1px 0 var(--mode-classic-inset);
    }
    .mode-card.active[data-mode="CHAOS"] .stone {
      background: var(--mode-chaos-bg);
      border-color: var(--mode-chaos-border);
      box-shadow: 0 6px 22px var(--mode-chaos-glow),
                  inset 0 1px 0 var(--mode-chaos-inset);
    }
    .mode-card.active[data-mode="RECONSTRUCTION"] .stone {
      background: var(--mode-recon-bg);
      border-color: var(--mode-recon-border);
      box-shadow: 0 6px 22px var(--mode-recon-glow),
                  inset 0 1px 0 var(--mode-recon-inset);
    }

    .stone-placeholder {
      position: absolute;
      bottom: 8px; width: 100%;
      text-align: center;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 10px;
      color: var(--text-muted);
      transition: color 0.25s;
    }
    .mode-card.active .stone-placeholder {
      color: rgba(255,255,255,0.28);
    }

    .card-label {
      font-family: var(--font-display);
      font-size: 13px;
      color: var(--text-secondary);
      transition: color 0.22s;
      letter-spacing: 0.02em;
    }
    .mode-card.active .card-label {
      color: var(--text-primary);
      font-weight: 500;
    }
  `;

  constructor() {
    super();
    this._selectedMode = 'STANDARD';
    this._selectedDifficulty = 'MEDIUM';
    this._ascension = 0;
    this._previewVisible = false;
    this._modes = [
      {
        mode: 'STANDARD',
        label: 'Classic',
        desc: 'The timeless 9×9 sudoku.\nPure logic, no gimmicks.',
        previewVar: '--preview-classic-bg'
      },
      {
        mode: 'CHAOS',
        label: 'Chaos',
        desc: 'Irregular regions break the familiar grid.\nExpect the unexpected.',
        previewVar: '--preview-chaos-bg'
      },
      {
        mode: 'RECONSTRUCTION',
        label: 'Reconstruction',
        desc: 'Place the pieces back where they belong.\nSpatial memory meets logic.',
        previewVar: '--preview-recon-bg'
      }
    ];
  }

  firstUpdated() {
    this._initPetals();
    setTimeout(() => this._selectMode('STANDARD'), 100);
  }

  _initPetals() {
    const canvas = this.shadowRoot.getElementById('petal-canvas');
    if (canvas) initPetals(canvas);
  }

  _selectMode(mode) {
    this._selectedMode = mode;
    const preview = this.shadowRoot.getElementById('preview');
    const inner = this.shadowRoot.getElementById('preview-inner');
    this._previewVisible = false;
    preview.classList.remove('visible');
    setTimeout(() => {
      const modeData = this._modes.find(m => m.mode === mode);
      inner.style.background =
        getComputedStyle(this).getPropertyValue(modeData.previewVar).trim()
        || modeData.previewVar;
      this._previewVisible = true;
      preview.classList.add('visible');
    }, 180);
    this.requestUpdate();
  }

  _changeAsc(delta) {
    this._ascension = Math.max(0, Math.min(19, this._ascension + delta));
    this.requestUpdate();
  }

  _onDiffChange(e) {
    this._selectedDifficulty = e.target.value;
  }

  _onBegin() {
    this._dispatch({
      type: 'GAME/START',
      payload: {
        mode: this._selectedMode,
        difficulty: this._selectedDifficulty,
        ascension: this._ascension,
        seed: String(Date.now())
      }
    });
  }

  _onBack() {
    this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } });
  }

  _dispatch(action) {
    this.dispatchEvent(new CustomEvent('dispatch-action', {
      detail: action, bubbles: true, composed: true
    }));
  }

  _getSelectedMode() {
    return this._modes.find(m => m.mode === this._selectedMode);
  }

  render() {
    return html`
      <div class="petals-layer">
        <canvas id="petal-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
      </div>

      <div class="preview ${this._previewVisible ? 'visible' : ''}" id="preview">
        <div class="preview-inner" id="preview-inner">puzzle preview</div>
      </div>

      <div class="ui">
        <div class="topbar">
          <button class="back-btn" @mousedown="${e => e.preventDefault()}"
            @click="${this._onBack}">← Back</button>
          <div class="top-title">Select Mode</div>
          <div style="width:60px"></div>
        </div>

        <div class="content">
          <div class="left-panel ${this._selectedMode ? 'visible' : ''}" id="left-panel">
            <div class="mode-title">${this._getSelectedMode()?.label}</div>
            <div class="mode-desc">${this._getSelectedMode()?.desc}</div>
            <div class="controls">
              <div>
                <div class="ctl-label">Difficulty</div>
                <select class="diff-select"
                  @change="${this._onDiffChange}">
                  ${difficulties.map(d => html`
                    <option value="${d.value}"
                      ?selected="${d.value === this._selectedDifficulty}">
                      ${d.label}
                    </option>
                  `)}
                </select>
              </div>
              <div>
                <div class="ctl-label">Ascension</div>
                <div class="asc-row">
                  <button class="asc-btn"
                    @mousedown="${e => e.preventDefault()}"
                    @click="${() => this._changeAsc(-1)}">‹</button>
                  <div class="asc-num">${this._ascension}</div>
                  <button class="asc-btn"
                    @mousedown="${e => e.preventDefault()}"
                    @click="${() => this._changeAsc(1)}">›</button>
                </div>
                <div class="asc-sub">${ascLabels[this._ascension]}</div>
              </div>
            </div>
          </div>

          <button class="begin-btn ${this._selectedMode ? 'visible' : ''}"
            @click="${this._onBegin}">Begin →</button>

          <div class="cards-row">
            ${this._modes.map(m => html`
              <div class="mode-card ${this._selectedMode === m.mode ? 'active' : ''}"
                data-mode="${m.mode}"
                @click="${() => this._selectMode(m.mode)}">
                <div class="stone">
                  <div class="stone-placeholder">placeholder</div>
                </div>
                <div class="card-label">${m.label}</div>
              </div>
            `)}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('mode-select', ModeSelect);
