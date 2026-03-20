import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { ACHIEVEMENTS } from '../config/achievements.js';
import { initPetals } from '../utils/petals.js';

// Achievement icons: ./assets/achievements/<achievement-id>.png  (lowercase)
// e.g. first_solve.png, speed_demon.png, no_mistakes.png
// Missing icons fall back to a silhouette placeholder automatically.

// Enrich the base achievement list with category, secret, and progress metadata.
const ACH_META = {
  FIRST_SOLVE:      { category: 'milestone', secret: false },
  SPEED_DEMON:      { category: 'speed',     secret: false },
  NO_MISTAKES:      { category: 'milestone', secret: false },
  HINT_FREE:        { category: 'milestone', secret: false },
  CHAOS_COMPLETE:   { category: 'mode',      secret: false },
  RECON_COMPLETE:   { category: 'mode',      secret: false },
  FRAGILE_COMPLETE: { category: 'modifier',  secret: false },
  ORDERED_COMPLETE: { category: 'modifier',  secret: false },
  FIVE_STREAK:      { category: 'streak',    secret: false },
  TEN_STREAK:       { category: 'streak',    secret: false },
  USE_FIVE_HINTS:   { category: 'milestone', secret: false },
  VERY_HARD_SOLVE:  { category: 'milestone', secret: false },
  CANDIDATE_MASTER: { category: 'technique', secret: false },
  SPEED_VERY_HARD:  { category: 'speed',     secret: false },
  ALL_MODIFIERS:    { category: 'modifier',  secret: false },
};

const FILTERS = ['all', 'milestone', 'technique', 'speed', 'streak', 'mode', 'modifier', 'multiplayer', 'hidden'];
const FILTER_LABELS = {
  all: 'All', milestone: 'Milestone', technique: 'Technique',
  speed: 'Speed', streak: 'Streak', mode: 'Mode',
  modifier: 'Modifier', multiplayer: 'Multiplayer', hidden: 'Hidden',
};

const DIFFICULTIES = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];
const DIFF_LABELS   = { VERY_EASY: 'V.Easy', EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', VERY_HARD: 'V.Hard' };

function formatTime(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function achievementIcon(ach, unlocked) {
  const src = `./assets/achievements/${ach.id.toLowerCase()}.png`;
  const placeholder = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
      <rect width="44" height="44" rx="8" fill="rgba(160,120,80,0.15)"/>
      <circle cx="22" cy="18" r="7" fill="rgba(160,120,80,0.3)"/>
      <ellipse cx="22" cy="34" rx="12" ry="7" fill="rgba(160,120,80,0.3)"/>
    </svg>
  `)}`;
  return html`
    <img
      src="${src}"
      width="44"
      height="44"
      alt="${ach.name}"
      style="opacity:${unlocked ? 1 : 'var(--ach-locked-opacity)'};
             filter:${unlocked ? 'none' : 'grayscale(0.6)'};
             transition:opacity 0.2s,filter 0.2s;
             border-radius:6px;display:block;"
      @error="${e => { e.target.src = placeholder; }}"
    />
  `;
}

function achievementIconLarge(ach, unlocked) {
  const src = `./assets/achievements/${ach.id.toLowerCase()}.png`;
  const placeholder = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" rx="16" fill="rgba(160,120,80,0.1)"/>
      <circle cx="50" cy="40" r="16" fill="rgba(160,120,80,0.2)"/>
      <ellipse cx="50" cy="76" rx="28" ry="16" fill="rgba(160,120,80,0.2)"/>
    </svg>
  `)}`;
  return html`
    <img
      class="ach-modal-icon"
      src="${src}"
      alt="${ach.name}"
      style="opacity:${unlocked ? 1 : 'var(--ach-locked-opacity)'};
             filter:${unlocked ? 'none' : 'grayscale(0.6)'};"
      @error="${e => { e.target.src = placeholder; }}"
    />
  `;
}

export class ProgressScreen extends LitElement {
  static properties = {
    uiState:          { type: Object },
    settingsState:    { type: Object },
    statsState:       { type: Object },
    achievementsState:{ type: Array },
    _activeFilter:    { type: String, state: true },
    _selectedAch:     { type: Object, state: true },
    _hoveredAch:      { type: Object, state: true },
    _mousePos:        { type: Object, state: true }
  };

  static styles = css`
    :host {
      display: block; width: 100%; height: 100vh;
      overflow: hidden;
      background: var(--bg-gradient);
      font-family: var(--font-ui);
      position: relative;
    }

    .petals-layer { position:absolute;inset:0;z-index:0;pointer-events:none; }

    .screen {
      position:absolute;inset:0;z-index:1;
      display:flex;flex-direction:column;overflow:hidden;
    }

    /* ── Topbar ─────────────────────────────────────────── */

    .topbar {
      display:flex;align-items:center;justify-content:space-between;
      padding:18px 28px 10px;flex-shrink:0;
    }

    .back-btn {
      font-family:var(--font-display);font-style:italic;
      font-size:14px;color:var(--text-secondary);
      cursor:pointer;background:none;border:none;
      transition:color 0.2s;padding:0;
    }
    .back-btn:hover { color:var(--text-primary); }

    .page-title {
      font-family:var(--font-display);font-size:22px;
      font-weight:500;color:var(--text-primary);
    }

    /* ── Scrollable body ─────────────────────────────────── */

    .body {
      flex:1;overflow-y:auto;padding:4px 32px 48px;
    }
    .body::-webkit-scrollbar { width:3px; }
    .body::-webkit-scrollbar-thumb {
      background:rgba(150,100,60,0.2);border-radius:2px;
    }

    /* ── Section chrome ─────────────────────────────────── */

    .eyebrow {
      font-size:9px;letter-spacing:0.14em;
      text-transform:uppercase;color:var(--text-muted);
      margin-bottom:12px;
    }

    .divider {
      height:1px;background:var(--glass-border);margin:22px 0;
    }

    /* ── Overview grid ──────────────────────────────────── */

    .overview-grid {
      display:grid;grid-template-columns:repeat(3,1fr);
      gap:18px 12px;
    }
    .ov-item { display:flex;flex-direction:column;gap:2px; }
    .ov-val {
      font-family:var(--font-numbers);
      font-size:var(--progress-val-size);font-weight:700;
      color:var(--text-primary);line-height:1;
      text-shadow:0 1px 4px rgba(255,255,255,0.2);
    }
    .ov-lbl {
      font-size:9px;letter-spacing:0.1em;
      text-transform:uppercase;color:var(--text-muted);
    }
    .ov-sub {
      font-family:var(--font-display);font-style:italic;
      font-size:11px;color:var(--text-secondary);margin-top:1px;
    }

    /* ── Best times ─────────────────────────────────────── */

    .times-row {
      display:flex;align-items:baseline;flex-wrap:wrap;row-gap:6px;
    }
    .time-item {
      display:flex;flex-direction:column;align-items:center;
      padding:0 14px 0 0;
    }
    .time-sep {
      width:1px;height:28px;
      background:var(--glass-border);
      margin-right:14px;align-self:center;
    }
    .t-diff {
      font-size:9px;letter-spacing:0.1em;
      text-transform:uppercase;color:var(--text-muted);
    }
    .t-val {
      font-family:var(--font-numbers);font-size:17px;
      font-weight:700;color:var(--text-primary);
    }

    /* ── Technique bars ─────────────────────────────────── */

    .tech-list { display:flex;flex-direction:column;gap:8px; }
    .tech-row { display:flex;align-items:center;gap:12px; }
    .tech-name {
      font-family:var(--font-display);font-size:12px;
      color:var(--text-primary);width:120px;flex-shrink:0;
    }
    .tech-bar-bg {
      flex:1;height:4px;
      background:var(--tech-bar-bg);
      border-radius:2px;overflow:hidden;
    }
    .tech-bar-fill {
      height:100%;border-radius:2px;
      background:var(--tech-bar-fill);
      transition:width 0.6s ease;
    }
    .tech-count {
      font-size:11px;color:var(--text-secondary);
      width:40px;text-align:right;
      font-family:var(--font-numbers);
    }

    .tech-empty {
      font-family:var(--font-display);font-style:italic;
      font-size:13px;color:var(--text-muted);
    }

    /* ── Achievement filters ─────────────────────────────── */

    .ach-filters {
      display:flex;gap:6px;margin-bottom:18px;flex-wrap:wrap;
    }
    .ach-filter {
      padding:3px 11px;border-radius:20px;
      font-size:10px;font-weight:500;
      border:1px solid var(--glass-border);
      background:transparent;color:var(--text-secondary);
      cursor:pointer;transition:all 0.15s;font-family:var(--font-ui);
    }
    .ach-filter:hover { color:var(--text-primary); }
    .ach-filter.active {
      background:rgba(192,90,58,0.1);
      border-color:var(--text-accent);
      color:var(--text-accent);
    }

    /* ── Achievement grid ───────────────────────────────── */

    .ach-grid {
      display:grid;
      grid-template-columns:repeat(5,1fr);
      gap:16px 8px;
    }
    .ach-item {
      display:flex;flex-direction:column;align-items:center;
      gap:5px;cursor:default;
      transition:transform 0.18s;text-align:center;
      width: fit-content;
      margin: 0 auto;
      padding: 4px 8px;
      border-radius: 8px;
    }
    .ach-item:hover { 
      transform:translateY(-2px);
      background: rgba(255, 255, 255, 0.05);
    }
    .ach-name {
      font-family:var(--font-display);font-size:10px;
      color:var(--text-primary);line-height:1.3;
    }
    .ach-name.locked { color:var(--text-muted); }
    .ach-prog {
      font-size:9px;color:var(--text-muted);
      letter-spacing:0.04em;
    }

    .ach-empty {
      grid-column: 1 / -1;
      font-family:var(--font-display);font-style:italic;
      font-size:13px;color:var(--text-muted);
      padding:12px 0;
    }

    /* ── Achievement Tooltip ────────────────── */

    .ach-tooltip {
      position: fixed;
      z-index: 2000;
      pointer-events: none;
      background: var(--glass-bg);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid var(--glass-border);
      border-radius: 8px;
      padding: 10px 14px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      max-width: 220px;
      animation: tooltip-in 0.15s ease-out;
      transform: translate(-50%, -100%);
      margin-top: -12px;
    }

    @keyframes tooltip-in {
      from { opacity: 0; transform: translate(-50%, -95%); }
      to   { opacity: 1; transform: translate(-50%, -100%); }
    }

    .ach-tooltip-text {
      font-family: var(--font-display);
      font-size: 11px;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* ── Achievement Modal ────────────────────────────── */

    .ach-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: rgba(60, 40, 20, 0.4);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      animation: ach-fade-in 0.3s ease-out forwards;
    }

    @keyframes ach-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .ach-modal {
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 40px;
      box-shadow: var(--glass-shadow);
      max-width: 400px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      animation: ach-pop-in 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    @keyframes ach-pop-in {
      from { opacity: 0; transform: scale(0.8) translateY(20px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    .ach-modal-icon {
      width: 100px;
      height: 100px;
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }

    .ach-modal-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 500;
      color: var(--text-primary);
      margin: 0;
    }

    .ach-modal-desc {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 16px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .ach-modal-close {
      margin-top: 10px;
      padding: 10px 24px;
      border-radius: var(--radius-chip);
      background: var(--chip-bg);
      border: none;
      color: var(--text-primary);
      font-family: var(--font-display);
      font-style: italic;
      cursor: pointer;
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }

    .ach-modal-close:hover {
      background: var(--chip-bg-hover);
      transform: translateY(-1px);
    }

    /* ── Animations ────────────────────────────────────── */

    @keyframes fade-float-in {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .animate-in {
      animation: fade-float-in 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }

    .delay-1 { animation-delay: 0.1s; }
    .delay-2 { animation-delay: 0.2s; }
    .delay-3 { animation-delay: 0.3s; }
    .delay-4 { animation-delay: 0.4s; }
    .delay-5 { animation-delay: 0.5s; }
    .delay-6 { animation-delay: 0.6s; }
  `;

  constructor() {
    super();
    this.statsState = null;
    this.achievementsState = [];
    this._activeFilter = 'all';
    this._selectedAch = null;
    this._hoveredAch = null;
    this._mousePos = { x: 0, y: 0 };
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

  _isUnlocked(ach) {
    if (!this.achievementsState || !Array.isArray(this.achievementsState)) return false;
    return this.achievementsState.includes(ach.id);
  }

  _getStats() {
    const s = this.statsState || {};
    return {
      totalSolved: s.totalSolved ?? 0,
      streaks:     s.streaks     ?? 0,
      hintsUsed:   s.hintsUsed   ?? 0,
      bestTimes:   s.bestTimes   ?? {},
      techniques:  s.techniques  ?? {},
    };
  }

  _getEnrichedAchievements() {
    const stats = this._getStats();
    return ACHIEVEMENTS.map(ach => {
      const meta = ACH_META[ach.id] || { category: 'milestone', secret: false };
      let progress = null;
      if (ach.id === 'FIVE_STREAK')   progress = { current: Math.min(stats.streaks, 5),  max: 5  };
      if (ach.id === 'TEN_STREAK')    progress = { current: Math.min(stats.streaks, 10), max: 10 };
      if (ach.id === 'USE_FIVE_HINTS') progress = { current: Math.min(stats.hintsUsed, 5), max: 5 };
      return { ...ach, name: ach.label, ...meta, progress };
    });
  }

  _getFilteredAchievements() {
    const all = this._getEnrichedAchievements();
    const f = this._activeFilter;
    if (f === 'all')    return all;
    if (f === 'hidden') return all.filter(a => a.secret);
    return all.filter(a => a.category === f);
  }

  _renderOverview() {
    const { totalSolved, streaks, hintsUsed, bestTimes } = this._getStats();
    const unlocked = (this.achievementsState || []).length;
    const total    = ACHIEVEMENTS.length;

    const fastestMs = Object.values(bestTimes).filter(Boolean).reduce((a, b) => Math.min(a, b), Infinity);
    const fastest   = isFinite(fastestMs) ? formatTime(fastestMs) : '—';

    const items = [
      { val: totalSolved,            lbl: 'Solved'       },
      { val: streaks,                lbl: 'Day Streak'   },
      { val: hintsUsed,             lbl: 'Hints Used'   },
      { val: fastest,                lbl: 'Best Time'    },
      { val: `${unlocked}/${total}`, lbl: 'Achievements' },
    ];

    return html`
      <div class="overview-grid animate-in delay-2">
        ${items.map(i => html`
          <div class="ov-item">
            <div class="ov-val">${i.val}</div>
            <div class="ov-lbl">${i.lbl}</div>
          </div>
        `)}
      </div>
    `;
  }

  _renderBestTimes() {
    const { bestTimes } = this._getStats();
    const diffs = DIFFICULTIES.filter(d => bestTimes[d]);
    if (!diffs.length) {
      return html`<div class="tech-empty animate-in delay-3">No puzzles completed yet.</div>`;
    }
    return html`
      <div class="times-row animate-in delay-3">
        ${diffs.map((d, i) => html`
          ${i > 0 ? html`<div class="time-sep"></div>` : ''}
          <div class="time-item">
            <div class="t-diff">${DIFF_LABELS[d]}</div>
            <div class="t-val">${formatTime(bestTimes[d])}</div>
          </div>
        `)}
      </div>
    `;
  }

  _renderTechniques() {
    const { techniques } = this._getStats();
    const entries = Object.entries(techniques)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (!entries.length) {
      return html`<div class="tech-empty animate-in delay-4">No technique data yet.</div>`;
    }

    const maxCount = entries[0][1];
    return html`
      <div class="tech-list animate-in delay-4">
        ${entries.map(([name, count]) => html`
          <div class="tech-row">
            <div class="tech-name">${name}</div>
            <div class="tech-bar-bg">
              <div class="tech-bar-fill"
                style="width:${maxCount > 0 ? (count / maxCount * 100).toFixed(1) : 0}%">
              </div>
            </div>
            <div class="tech-count">${count}</div>
          </div>
        `)}
      </div>
    `;
  }

  _renderAchievements() {
    const filtered = this._getFilteredAchievements();
    if (!filtered.length) {
      return html`<div class="ach-empty animate-in delay-6">No achievements in this category.</div>`;
    }
    return html`
      <div class="ach-grid animate-in delay-6">
        ${filtered.map((ach, idx) => {
          const unlocked = this._isUnlocked(ach);
          const secret   = ach.secret && !unlocked;
          const display  = secret ? { ...ach, id: 'hidden', name: '???' } : ach;
          return html`
            <div class="ach-item" 
                 style="animation-delay: ${0.6 + (idx * 0.03)}s"
                 @mouseenter="${(e) => { this._hoveredAch = display; this._updateMousePos(e); }}"
                 @mousemove="${(e) => { this._updateMousePos(e); }}"
                 @mouseleave="${() => { this._hoveredAch = null; }}"
                 @click="${() => { this._selectedAch = { ...display, unlocked }; }}">
              ${achievementIcon(display, unlocked)}
              <div class="ach-name ${unlocked ? '' : 'locked'}">
                ${display.name}
              </div>
              ${ach.progress && !secret ? html`
                <div class="ach-prog">${ach.progress.current}/${ach.progress.max}</div>
              ` : ''}
            </div>
          `;
        })}
      </div>
    `;
  }

  _updateMousePos(e) {
    this._mousePos = { x: e.clientX, y: e.clientY };
  }

  _renderTooltip() {
    if (!this._hoveredAch) return '';
    return html`
      <div class="ach-tooltip" style="left: ${this._mousePos.x}px; top: ${this._mousePos.y}px;">
        <div class="ach-tooltip-text">${this._hoveredAch.description}</div>
      </div>
    `;
  }

  _renderAchModal() {
    if (!this._selectedAch) return '';
    const ach = this._selectedAch;
    return html`
      <div class="ach-modal-overlay" @click="${() => { this._selectedAch = null; }}">
        <div class="ach-modal" @click="${e => e.stopPropagation()}">
          ${achievementIconLarge(ach, ach.unlocked)}
          <h2 class="ach-modal-title">${ach.name}</h2>
          <p class="ach-modal-desc">${ach.description}</p>
          <button class="ach-modal-close" @click="${() => { this._selectedAch = null; }}">Close</button>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="petals-layer">
        <canvas id="petal-canvas" style="position:absolute;inset:0;width:100%;height:100%;"></canvas>
      </div>

      <div class="screen">
        <div class="topbar animate-in delay-1">
          <button class="back-btn" @click="${this._onBack}">← Back</button>
          <div class="page-title">Progress</div>
          <div style="width:60px"></div>
        </div>

        <div class="body">

          <div class="eyebrow animate-in delay-2">Overview</div>
          ${this._renderOverview()}

          <div class="divider animate-in delay-3"></div>

          <div class="eyebrow animate-in delay-3">Best Times</div>
          ${this._renderBestTimes()}

          <div class="divider animate-in delay-4"></div>

          <div class="eyebrow animate-in delay-4">Techniques Used Most</div>
          ${this._renderTechniques()}

          <div class="divider animate-in delay-5"></div>

          <div class="eyebrow animate-in delay-5">Achievements</div>
          <div class="ach-filters animate-in delay-5">
            ${FILTERS.map(f => html`
              <button
                class="ach-filter ${this._activeFilter === f ? 'active' : ''}"
                @click="${() => { this._activeFilter = f; this.requestUpdate(); }}"
              >${FILTER_LABELS[f]}</button>
            `)}
          </div>
          ${this._renderAchievements()}

        </div>
      </div>

      ${this._renderAchModal()}
      ${this._renderTooltip()}
    `;
  }
}

customElements.define('progress-screen', ProgressScreen);
