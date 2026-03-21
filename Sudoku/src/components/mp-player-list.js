import { LitElement, html, css } from 'https://esm.sh/lit@3';

export class MpPlayerList extends LitElement {
  static properties = {
    peers: { type: Array },
    localPeerId: { type: String },
    compact: { type: Boolean },
    hideDisconnected: { type: Boolean }
  };

  static styles = css`
    :host {
      display: block;
    }

    .player-list {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    :host([compact]) .player-list {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.9rem;
    }

    .player-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 4px 8px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.05);
    }

    :host([compact]) .player-item {
      background: transparent;
      padding: 0;
    }

    .player-item.is-local {
      outline: 2px solid #2196f3;
    }

    :host([compact]) .player-item.is-local {
      outline: none;
      font-weight: bold;
    }

    .color-swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 150px;
    }

    .host-crown {
      color: #ffb300;
      font-size: 0.8em;
    }

    .status-icon {
      margin-left: auto;
      font-size: 0.9em;
    }

    .status-confirmed {
      color: #4caf50;
    }

    .status-waiting {
      color: #999;
      font-style: italic;
      font-size: 0.8em;
    }

    .player-item.is-disconnected {
      opacity: 0.45;
    }

    .player-item.is-disconnected .name {
      text-decoration: line-through;
    }

    .status-disconnected {
      color: #f44336;
    }
  `;

  render() {
    if (!this.peers) return html``;

    const visiblePeers = this.hideDisconnected 
      ? this.peers.filter(p => p.connected !== false)
      : this.peers;

    return html`
      <div class="player-list">
        ${visiblePeers.map(peer => html`
          <div class="player-item ${peer.id === this.localPeerId ? 'is-local' : ''} ${peer.connected === false ? 'is-disconnected' : ''}">
            <div class="color-swatch" style="background-color: ${peer.color || '#ccc'}"></div>
            <span class="name">${peer.name || 'Anonymous'}</span>
            ${peer.isHost ? html`<span class="host-crown">👑</span>` : ''}

            ${!this.compact ? html`
              ${peer.connected === false
                ? html`<span class="status-icon status-disconnected">✕</span>`
                : html`<span class="status-icon ${peer.confirmed ? 'status-confirmed' : 'status-waiting'}">
                    ${peer.isHost ? '' : (peer.confirmed ? '✓' : 'waiting...')}
                  </span>`
              }
            ` : ''}
          </div>
        `)}
      </div>
    `;
  }
}

customElements.define('mp-player-list', MpPlayerList);
