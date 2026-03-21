import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { keyed } from 'https://esm.sh/lit@3/directives/keyed.js';
import { puzzleToGameState } from '../services/puzzleLoader.js';

const CHALLENGES = [
  {
    id: 'daily_very_easy',
    category: 'daily',
    label: 'Very Easy',
    subtitle: 'Daily Warm-up',
    seed: 'DAILY',
    description: 'A gentle start to your day. Pure logic, no advanced techniques required.',
    tags: ['Very Easy', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'VERY_EASY', mode: 'STANDARD' } }
  },
  {
    id: 'daily_easy',
    category: 'daily',
    label: 'Easy',
    subtitle: 'Quick Fix',
    seed: 'DAILY',
    description: 'Perfect for a quick mental break. Requires basic scanning and simple deductions.',
    tags: ['Easy', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'EASY', mode: 'STANDARD' } }
  },
  {
    id: 'daily_medium',
    category: 'daily',
    label: 'Medium',
    subtitle: 'Steady Challenge',
    seed: 'DAILY',
    description: 'A balanced puzzle that might require some intermediate logic like naked pairs.',
    tags: ['Medium', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'MEDIUM', mode: 'STANDARD' } }
  },
  {
    id: 'daily_hard',
    category: 'daily',
    label: 'Hard',
    subtitle: 'Logic Test',
    seed: 'DAILY',
    description: 'For those who want a serious test. Be prepared for X-Wings and hidden triples.',
    tags: ['Hard', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'HARD', mode: 'STANDARD' } }
  },
  {
    id: 'daily_very_hard',
    category: 'daily',
    label: 'Expert',
    subtitle: 'Master Class',
    seed: 'DAILY',
    description: 'The ultimate daily challenge. Only for those who have mastered advanced Sudoku techniques.',
    tags: ['Very Hard', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'VERY_HARD', mode: 'STANDARD' } }
  },
  {
    id: 'lorelei',
    category: 'other',
    label: 'The Lorelei',
    subtitle: 'As it was meant to be.',
    description: '',
    tags: ['Very Easy', 'Modifier', 'Daily'],
    action: { type: 'GAME/START', payload: { difficulty: 'VERY_EASY', mode: 'STANDARD', modifiers: ['ORDERED', 'NO_CANDIDATES'] } }
  },
];

export class ChallengesScreen extends LitElement {
  static properties = {
    statsState: { type: Object },
    settingsState: { type: Object },
    achievementsState: { type: Array },
    _selectedId: { type: String },
    _showPopup: { type: Boolean, state: true }
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      padding: 0 2rem;
      box-sizing: border-box;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 0 32px;
      position: relative;
    }

    .back-btn {
      position: absolute;
      left: 0;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      transition: color 0.2s;
      padding: 0;
    }
    .back-btn:hover { color: var(--text-primary); }

    .header-title {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .screen-title {
      font-family: var(--font-display);
      font-size: 28px;
      font-weight: 500;
      color: var(--text-primary);
      text-shadow: 0 1px 3px rgba(255,255,255,0.3);
    }

    .screen-sub {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 14px;
      color: var(--text-accent);
      margin-top: -2px;
    }

    .layout {
      display: flex;
      gap: 0;
      flex: 1;
      max-width: 860px;
      width: 100%;
      margin: 0 auto;
    }

    .sidebar {
      width: 210px;
      flex-shrink: 0;
      padding-top: 4px;
    }

    .section-header {
      font-family: var(--font-display);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-accent);
      margin: 16px 0 8px 4px;
      opacity: 0.8;
    }

    .section-header:first-child {
      margin-top: 0;
    }

    .section-divider {
      height: 1px;
      background: var(--glass-border);
      margin: 12px 16px 12px 4px;
      opacity: 0.5;
    }

    .item {
      padding: 9px 16px 9px 4px;
      font-family: var(--font-display);
      font-size: 15px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: color 0.15s, background 0.2s, padding-left 0.15s;
      border-radius: 3px 0 0 3px;
      user-select: none;
      white-space: nowrap;
    }

    .item:hover {
      color: var(--text-primary);
    }

    .item.is-selected {
      color: var(--text-primary);
      background: linear-gradient(to right, rgba(192,90,58,0.22) 0%, transparent 100%);
      padding-left: 14px;
    }

    .divider {
      width: 1px;
      background: var(--glass-border);
      margin: 4px 0 24px;
      flex-shrink: 0;
    }

    .detail {
      flex: 1;
      padding: 4px 0 40px 48px;
      animation: detail-in 0.38s ease-out forwards;
    }

    @keyframes detail-in {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .challenge-title {
      font-family: var(--font-display);
      font-size: 38px;
      font-weight: 500;
      color: var(--text-primary);
      line-height: 1.1;
      margin: 0 0 4px;
    }

    .challenge-subtitle {
      font-family: var(--font-display);
      font-style: italic;
      font-size: 16px;
      color: var(--text-accent);
      margin: 0 0 22px;
    }

    .tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 22px;
    }

    .tag {
      font-family: var(--font-ui);
      font-size: 10px;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--text-secondary);
      background: var(--chip-bg);
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      box-shadow: var(--chip-shadow);
    }

    .challenge-desc {
      font-family: var(--font-ui);
      font-size: 14px;
      line-height: 1.75;
      color: var(--text-secondary);
      max-width: 460px;
      margin-bottom: 36px;
    }

    .start-btn {
      padding: 11px 32px;
      border-radius: var(--radius-chip);
      border: none;
      cursor: pointer;
      font-family: var(--font-display);
      font-style: italic;
      font-size: 16px;
      color: var(--chip-active-color);
      background: var(--chip-active-bg);
      box-shadow: var(--chip-shadow);
      transition: all 0.15s;
    }
    .start-btn:hover { filter: brightness(1.12); }
    .start-btn:active { box-shadow: var(--chip-shadow-active); transform: scale(0.97); }

    /* Popup/Modal styles */
    .popup-overlay {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(40, 28, 16, 0.38);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: fade-in 0.2s ease-out;
    }

    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    .popup-content {
      background: var(--modal-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      padding: 36px;
      box-shadow: var(--glass-shadow);
      width: min(88vw, 420px);
      max-height: 85vh;
      overflow-y: auto;
      animation: scale-in 0.2s ease-out;
      position: relative;
    }

    @keyframes scale-in {
      from { transform: scale(0.96); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    .popup-x-close {
      position: absolute;
      top: 14px;
      right: 14px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 20px;
      transition: color 0.15s;
      padding: 0;
    }
    .popup-x-close:hover { color: var(--text-primary); }

    .popup-content .start-btn {
      width: 100%;
      margin-top: 12px;
    }

    @media (max-width: 640px) {
      :host { padding: 0 1rem; }

      .layout {
        flex-direction: column;
        gap: 0;
      }

      .sidebar {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 0 0 16px;
      }

      .item {
        padding: 14px 16px;
        border-radius: var(--radius-chip);
        font-size: 15px;
        background: var(--glass-bg);
        border: 1px solid var(--glass-border);
        box-shadow: var(--hud-btn-shadow);
        white-space: normal;
        margin-bottom: 4px;
      }

      .item.is-selected {
        background: var(--glass-bg);
        border-color: var(--glass-border);
        color: var(--text-secondary);
        padding-left: 16px;
      }

      .divider { display: none; }

      .detail {
        display: none;
      }

      .challenge-title { font-size: 28px; }
    }
  `;

  constructor() {
    super();
    this._selectedId = CHALLENGES[0].id;
    this._showPopup = false;
  }

  _dispatch(detail) {
    this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
  }

  _onItemClick(id) {
    this._selectedId = id;
    if (window.innerWidth <= 640) {
      this._showPopup = true;
    }
  }

  _start(challenge) {
    this._showPopup = false;
    if (challenge.puzzle) {
      // Pre-defined puzzle string
      const record = {
        id: challenge.id,
        puzzle: challenge.puzzle,
        solution: challenge.solution || challenge.puzzle, // Fallback if no solution provided
        jigsaw_layout: challenge.jigsaw_layout || null,
        difficulty: challenge.action.payload.difficulty || 'MEDIUM',
        type: challenge.action.payload.mode === 'CHAOS' ? 'jigsaw' : 'classic',
        techniques_used: [],
        normalized_score: 0
      };
      const gameState = puzzleToGameState(record);
      
      // Dispatch START first to set mode/difficulty/modifiers
      this._dispatch({
        ...challenge.action,
        payload: {
          ...challenge.action.payload,
          seed: challenge.id,
          _skipGenerate: true
        }
      });
      
      // Then load the specific cells/regions
      this._dispatch({
        type: 'GAME/LOAD',
        payload: {
          ...gameState,
          // Merge in any other relevant fields from action payload if needed
        }
      });
      
      this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'GAME' } });
      return;
    }

    const action = { ...challenge.action };
    let seed = challenge.seed;
    if (seed === 'DAILY') {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const yyyy = now.getFullYear();
      seed = `${mm}-${dd}-${yyyy}`;
    }
    if (seed !== undefined && action.payload) {
      action.payload = { ...action.payload, seed: String(seed) };
    }
    this._dispatch(action);
  }

  render() {
    const ICON_X = html`<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 6L6 18M6 6l12 12"/></svg>`;
    const selected = CHALLENGES.find(c => c.id === this._selectedId) ?? CHALLENGES[0];
    
    // Process tags: replace 'Modifier' with actual modifier labels if available
    const activeModifiers = selected.action?.payload?.modifiers || [];
    const processedTags = (tags) => tags.flatMap(tag => {
      if (tag === 'Modifier') {
        return activeModifiers.map(m => m.toLowerCase().replace(/_/g, ' '));
      }
      return tag;
    });

    const detailTemplate = (c) => {
      const pTags = processedTags(c.tags);
      return html`
        <div class="challenge-title">${c.label}</div>
        <div class="challenge-subtitle">${c.subtitle}</div>
        <div class="tags">
          ${pTags.map(t => html`<span class="tag">${t}</span>`)}
        </div>
        <div class="challenge-desc">${c.description}</div>
        <button class="start-btn" @click="${() => this._start(c)}">Start →</button>
      `;
    };

    return html`
      <div class="header">
        <button class="back-btn"
          @mousedown="${e => e.preventDefault()}"
          @click="${() => this._dispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } })}">← Menu</button>
        <div class="header-title">
          <div class="screen-title">Challenges</div>
          <div class="screen-sub">by Abe</div>
        </div>
      </div>

      <div class="layout">
        <div class="sidebar">
          <div class="section-header">Daily</div>
          ${CHALLENGES.filter(c => c.category === 'daily').map(c => html`
            <div class="item ${c.id === this._selectedId ? 'is-selected' : ''}"
                 @click="${() => this._onItemClick(c.id)}">
              ${c.label}
            </div>
          `)}
          
          <div class="section-divider"></div>
          
          ${CHALLENGES.filter(c => c.category !== 'daily').map(c => html`
            <div class="item ${c.id === this._selectedId ? 'is-selected' : ''}"
                 @click="${() => this._onItemClick(c.id)}">
              ${c.label}
            </div>
          `)}
        </div>

        <div class="divider"></div>

        <div class="detail">
          ${keyed(selected.id, detailTemplate(selected))}
        </div>
      </div>

      ${this._showPopup ? html`
        <div class="popup-overlay" @click="${() => this._showPopup = false}">
          <div class="popup-content" @click="${e => e.stopPropagation()}">
            <button class="popup-x-close" @click="${() => this._showPopup = false}">${ICON_X}</button>
            ${detailTemplate(selected)}
          </div>
        </div>
      ` : ''}
    `;
  }
}

customElements.define('challenges-screen', ChallengesScreen);
