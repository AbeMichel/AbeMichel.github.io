import { LitElement, html, css } from 'https://esm.sh/lit@3';

// scale: multiply input value to get stored value (null = 1:1); type: 'select' uses options array
const CATALOG = [
  { id: 'FRAGILE',        label: 'Fragile',        desc: 'Any wrong placement immediately resets the board.',        config: null },
  { id: 'DECAYING',       label: 'Decaying',        desc: 'Placed values vanish after a set amount of time.',         config: [{ key: 'duration', label: 'Lifetime', unit: 'sec', min: 5,  max: 300, default: 30, scale: 1000  }] },
  { id: 'SYMBOLS',        label: 'Symbols',         desc: 'Digits are replaced with emoji symbols.',                  config: null },
  { id: 'NO_CANDIDATES',  label: 'No Notes',        desc: 'Candidate marking is entirely disabled.',                  config: null },
  { id: 'CANDIDATE_ONLY', label: 'Notes Only',      desc: 'Only candidate marks — completing a cell auto-fills it.', config: null },
  { id: 'BLACKOUT',       label: 'Blackout',        desc: 'Cells are hidden until you click them.',                   config: [{ key: 'revealScope', label: 'Reveal', type: 'select', options: [{value:'CELL',label:'Cell only'},{value:'CROSS',label:'Row & Col'},{value:'BOX',label:'Box'}], default: 'CELL' }] },
  { id: 'TIME_OUT',       label: 'Time Limit',      desc: 'The board resets when the countdown reaches zero.',        config: [{ key: 'duration', label: 'Limit', unit: 'min', min: 1,  max: 60,  default: 5,  scale: 60000 }] },
  { id: 'ORDERED',        label: 'Ordered',         desc: 'Fill digits in strict order before moving to the next.',  config: [{ key: 'direction', label: 'Order', type: 'select', options: [{value:'ASC',label:'1 → 9'},{value:'DESC',label:'9 → 1'}], default: 'ASC' }] },
  { id: 'SMALL_NOTEPAD',  label: 'Small Notepad',   desc: 'Total candidate marks across the board are capped.',       config: [{ key: 'limit',    label: 'Cap',    unit: '',    min: 5,  max: 200, default: 30, scale: null  }] },
  { id: 'LIVING',         label: 'Living (WIP)',    desc: 'The board randomly rearranges rows and columns. (Under Maintenance)',          config: null, disabled: true },
];

export class ModifierPicker extends LitElement {
  static properties = {
    active:         { type: Array },
    config:         { type: Object },
    _active:        { state: true },
    _config:        { state: true },
  };

  static styles = css`
    .overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      background: rgba(24, 16, 8, 0.6);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fade-in 0.18s ease;
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .card {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--glass-shadow);
      width: min(92vw, 440px);
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      animation: pop-in 0.2s ease;
    }
    @keyframes pop-in {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .card-header {
      padding: 18px 22px 14px;
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      border-bottom: 1px solid var(--glass-border);
      flex-shrink: 0;
    }
    .card-title {
      font-family: var(--font-display);
      font-size: 18px;
      font-weight: 500;
      color: var(--text-primary);
    }
    .card-sub {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 11px;
      color: var(--text-muted);
    }

    .card-body {
      overflow-y: auto;
      padding: 6px 22px 4px;
      flex: 1;
    }
    .card-body::-webkit-scrollbar { width: 3px; }
    .card-body::-webkit-scrollbar-thumb { background: rgba(150,100,60,0.2); border-radius: 2px; }

    .mod-row {
      padding: 10px 0;
      border-bottom: 1px solid rgba(150,100,60,0.08);
    }
    .mod-row:last-child { border-bottom: none; }

    .mod-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .mod-info { flex: 1; min-width: 0; }
    .mod-label {
      font-family: var(--font-display);
      font-size: 13px;
      color: var(--text-primary);
    }
    .mod-desc {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .toggle {
      flex-shrink: 0;
      width: 36px;
      height: 20px;
      border-radius: 10px;
      border: 1px solid var(--glass-border);
      background: var(--chip-bg);
      cursor: pointer;
      position: relative;
      transition: background 0.18s, border-color 0.18s;
    }
    .toggle.disabled {
      opacity: 0.3;
      cursor: not-allowed;
      filter: grayscale(1);
    }
    .toggle.on {
      background: var(--chip-active-bg);
      border-color: var(--chip-active-bg);
    }
    .thumb {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: var(--text-muted);
      transition: transform 0.15s, background 0.18s;
    }
    .toggle.on .thumb {
      transform: translateX(16px);
      background: var(--chip-active-color);
    }

    .mod-config {
      margin-top: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cfg-label {
      font-family: var(--font-display);
      font-size: 11px;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .cfg-input {
      width: 54px;
      padding: 3px 7px;
      border-radius: var(--radius-chip);
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.06);
      color: var(--text-primary);
      font-family: var(--font-numbers);
      font-size: 13px;
      text-align: center;
      outline: none;
    }
    .cfg-unit {
      font-family: var(--font-display);
      font-size: 11px;
      color: var(--text-muted);
    }
    .cfg-select {
      padding: 3px 7px;
      border-radius: var(--radius-chip);
      border: 1px solid var(--glass-border);
      background: rgba(255,255,255,0.06);
      color: var(--text-primary);
      font-family: var(--font-display);
      font-size: 12px;
      outline: none;
      cursor: pointer;
    }

    .card-footer {
      padding: 12px 22px 16px;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      border-top: 1px solid var(--glass-border);
      flex-shrink: 0;
    }
    .btn-cancel {
      padding: 8px 18px;
      border-radius: var(--radius-chip);
      border: none;
      cursor: pointer;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--text-secondary);
      background: transparent;
      transition: color 0.15s;
    }
    .btn-cancel:hover { color: var(--text-primary); }
    .btn-apply {
      padding: 8px 22px;
      border-radius: var(--radius-chip);
      border: none;
      cursor: pointer;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 13px;
      color: var(--chip-active-color);
      background: var(--chip-active-bg);
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }
    .btn-apply:hover { filter: brightness(1.1); }
  `;

  constructor() {
    super();
    this.active = [];
    this.config = {};
    this._active = new Set();
    this._config = {};
  }

  willUpdate(changed) {
    if (changed.has('active')) this._active = new Set(this.active || []);
    if (changed.has('config')) this._config = { ...(this.config || {}) };
  }

  _toggle(id) {
    const next = new Set(this._active);
    if (next.has(id)) next.delete(id); else next.add(id);
    this._active = next;
  }

  _getVal(id, key, scale, def) {
    const v = this._config[id]?.[key];
    if (v == null) return def;
    return scale ? Math.round(v / scale) : v;
  }

  _setVal(id, key, val, scale) {
    const stored = scale ? val * scale : val;
    this._config = { ...this._config, [id]: { ...(this._config[id] || {}), [key]: stored } };
  }

  _apply() {
    this.dispatchEvent(new CustomEvent('modifier-change', {
      detail: { modifiers: [...this._active], modifierConfig: { ...this._config } },
      bubbles: true, composed: true
    }));
  }

  _close() {
    this.dispatchEvent(new CustomEvent('modifier-close', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="overlay" @click="${this._close}">
        <div class="card" @click="${e => e.stopPropagation()}">

          <div class="card-header">
            <div class="card-title">Modifiers</div>
            <div class="card-sub">Stack rule changes</div>
          </div>

          <div class="card-body">
            ${CATALOG.map(mod => {
              const on = this._active.has(mod.id);
              return html`
                <div class="mod-row">
                  <div class="mod-main">
                    <div class="mod-info">
                      <div class="mod-label">${mod.label}</div>
                      <div class="mod-desc">${mod.desc}</div>
                    </div>
                    <div class="toggle ${on ? 'on' : ''} ${mod.disabled ? 'disabled' : ''}" @click="${() => !mod.disabled && this._toggle(mod.id)}">
                      <div class="thumb"></div>
                    </div>
                  </div>
                  ${on && mod.config ? html`
                    <div class="mod-config">
                      ${mod.config.map(cfg => html`
                        <span class="cfg-label">${cfg.label}</span>
                        ${cfg.type === 'select' ? html`
                          <select class="cfg-select"
                            .value="${this._getVal(mod.id, cfg.key, null, cfg.default)}"
                            @change="${e => this._setVal(mod.id, cfg.key, e.target.value, null)}">
                            ${cfg.options.map(o => html`<option value="${o.value}">${o.label}</option>`)}
                          </select>
                        ` : html`
                          <input
                            type="number"
                            class="cfg-input"
                            min="${cfg.min}"
                            max="${cfg.max}"
                            .value="${String(this._getVal(mod.id, cfg.key, cfg.scale, cfg.default))}"
                            @input="${e => this._setVal(mod.id, cfg.key, Number(e.target.value), cfg.scale)}"
                          />
                          ${cfg.unit ? html`<span class="cfg-unit">${cfg.unit}</span>` : ''}
                        `}
                      `)}
                    </div>
                  ` : ''}
                </div>
              `;
            })}
          </div>

          <div class="card-footer">
            <button class="btn-cancel" @click="${this._close}">Cancel</button>
            <button class="btn-apply" @click="${this._apply}">Apply</button>
          </div>

        </div>
      </div>
    `;
  }
}

customElements.define('modifier-picker', ModifierPicker);
