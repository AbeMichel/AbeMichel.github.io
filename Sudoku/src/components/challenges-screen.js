import { LitElement, html, css } from 'https://esm.sh/lit@3';
import { keyed } from 'https://esm.sh/lit@3/directives/keyed.js';

const CHALLENGES = [
  {
    id: 'daily',
    label: 'Daily Puzzle',
    subtitle: 'A new puzzle each day',
    description: 'A carefully chosen puzzle refreshed every day. Return daily to build your streak.',
    tags: ['Standard', 'Daily'],
    action: { type: 'GAME/LOAD_DAILY' }
  },
  {
    id: 'sprint',
    label: 'Speed Sprint',
    subtitle: 'Race the clock',
    description: 'Solve an easy puzzle as quickly as possible. Great for warming up your pattern recognition.',
    tags: ['Easy', 'Speed'],
    action: { type: 'GAME/START', payload: { difficulty: 'EASY', mode: 'STANDARD' } }
  },
  {
    id: 'flawless',
    label: 'Flawless',
    subtitle: 'No mistakes allowed',
    description: 'Complete a medium puzzle without a single error. Think twice before placing each number — there is no margin for error.',
    tags: ['Medium', 'Precision'],
    action: { type: 'GAME/START', payload: { difficulty: 'MEDIUM', mode: 'STANDARD' } }
  },
  {
    id: 'hard',
    label: 'Hard Mode',
    subtitle: 'Advanced techniques required',
    description: 'A hard difficulty puzzle that demands deeper logic. Naked pairs, hidden triples, X-wings — you will need them.',
    tags: ['Hard'],
    action: { type: 'GAME/START', payload: { difficulty: 'HARD', mode: 'STANDARD' } }
  },
  {
    id: 'expert',
    label: 'Expert',
    subtitle: 'The ultimate test',
    description: 'A very hard puzzle. The highest standard difficulty — master-level solving is required to crack this one.',
    tags: ['Very Hard'],
    action: { type: 'GAME/START', payload: { difficulty: 'VERY_HARD', mode: 'STANDARD' } }
  },
  {
    id: 'chaos',
    label: 'Chaos',
    subtitle: 'Irregular regions',
    description: 'The regions are no longer square. Solve a jigsaw sudoku where the boundaries twist and break convention.',
    tags: ['Medium', 'Chaos'],
    action: { type: 'GAME/START', payload: { difficulty: 'MEDIUM', mode: 'CHAOS' } }
  },
  {
    id: 'chaos_hard',
    label: 'Chaos Hard',
    subtitle: 'Jigsaw at its worst',
    description: 'Hard difficulty chaos mode. Irregular regions meet complex logic for a serious test of spatial reasoning.',
    tags: ['Hard', 'Chaos'],
    action: { type: 'GAME/START', payload: { difficulty: 'HARD', mode: 'CHAOS' } }
  },
  {
    id: 'reconstruction',
    label: 'Reconstruction',
    subtitle: 'Piece it together',
    description: 'Drag puzzle pieces onto the board to reconstruct the solution. A completely different kind of challenge that tests spatial thinking.',
    tags: ['Medium', 'Reconstruction'],
    action: { type: 'GAME/START', payload: { difficulty: 'MEDIUM', mode: 'RECONSTRUCTION' } }
  },
  {
    id: 'reconstruction_hard',
    label: 'Reconstruction Hard',
    subtitle: 'Pieces with rotation',
    description: 'Reconstruction mode at hard difficulty. Pieces can be rotated and mirrored, so orientation is part of the puzzle.',
    tags: ['Hard', 'Reconstruction'],
    action: { type: 'GAME/START', payload: { difficulty: 'HARD', mode: 'RECONSTRUCTION' } }
  },
];

export class ChallengesScreen extends LitElement {
  static properties = {
    statsState: { type: Object },
    settingsState: { type: Object },
    achievementsState: { type: Array },
    _selectedId: { type: String }
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

    @media (max-width: 640px) {
      :host { padding: 0 1rem; }

      .layout {
        flex-direction: column;
        gap: 0;
      }

      .sidebar {
        width: 100%;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 0 0 16px;
      }

      .item {
        padding: 6px 12px;
        border-radius: var(--radius-chip);
        font-size: 13px;
        background: transparent;
      }

      .item.is-selected {
        background: linear-gradient(to right, rgba(192,90,58,0.22) 0%, transparent 100%);
        padding-left: 12px;
      }

      .divider { display: none; }

      .detail {
        padding: 8px 0 40px;
        animation: detail-in 0.3s ease-out forwards;
      }

      .challenge-title { font-size: 28px; }
    }
  `;

  constructor() {
    super();
    this._selectedId = CHALLENGES[0].id;
  }

  _dispatch(detail) {
    this.dispatchEvent(new CustomEvent('dispatch-action', { detail, bubbles: true, composed: true }));
  }

  _start(challenge) {
    this._dispatch(challenge.action);
  }

  render() {
    const selected = CHALLENGES.find(c => c.id === this._selectedId) ?? CHALLENGES[0];

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
          ${CHALLENGES.map(c => html`
            <div class="item ${c.id === this._selectedId ? 'is-selected' : ''}"
                 @click="${() => { this._selectedId = c.id; }}">
              ${c.label}
            </div>
          `)}
        </div>

        <div class="divider"></div>

        ${keyed(selected.id, html`
          <div class="detail">
            <div class="challenge-title">${selected.label}</div>
            <div class="challenge-subtitle">${selected.subtitle}</div>
            <div class="tags">
              ${selected.tags.map(t => html`<span class="tag">${t}</span>`)}
            </div>
            <div class="challenge-desc">${selected.description}</div>
            <button class="start-btn" @click="${() => this._start(selected)}">Start →</button>
          </div>
        `)}
      </div>
    `;
  }
}

customElements.define('challenges-screen', ChallengesScreen);
