import Peer from 'https://esm.sh/peerjs@1.5.4';
import { Actions } from '../core/actions.js';
import { assignColor } from '../config/multiplayerColors.js';
import { getPlayerId } from './persistence.js';

let _peer = null;
let _connections = new Map(); // id -> connection
let _store = null;
let _isHost = false;
let _roomCode = null;
let _lastActionSequence = 0;

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

const SYNCABLE_ACTION_PREFIXES = ['BOARD/', 'RECON/', 'MP/GUEST_CONFIRM', 'COMPETITIVE/', 'MP/UPDATE_LOBBY_CONFIG', 'GAME/START'];

export function initMultiplayer(store) {
  _store = store;

  _store.subscribe((state, action) => {
    if (action._mpOrigin) return; // Ignore actions that came from the network

    const isSyncable = SYNCABLE_ACTION_PREFIXES.some(p => action.type.startsWith(p));
    if (!isSyncable) return;

    if (_isHost) {
      _handleLocalActionHost(state, action);
    } else if (_peer && !state.multiplayer.isHost && state.multiplayer.status !== 'DISCONNECTED') {
      _handleLocalActionGuest(state, action);
    }
  });
}

export async function createRoom(playerName, mpMode, gameConfig) {
  return new Promise((resolve, reject) => {
    _peer = new Peer(generateRoomCode());
    
    _peer.on('open', (id) => {
      _isHost = true;
      _roomCode = id;
      
      _store.dispatch({
        type: Actions.MP.CONNECT,
        payload: { peerId: id, isHost: true, playerName, roomCode: id, mpMode }
      });

      _store.dispatch({
        type: Actions.MP.PEER_JOINED,
        payload: {
          peerId: id,
          name: playerName,
          isHost: true,
          color: assignColor(0),
          playerId: getPlayerId()
        }
      });

      _store.dispatch({
        type: Actions.MP.SET_STATUS,
        payload: { status: 'LOBBY' }
      });

      resolve(id);
    });

    _peer.on('connection', (conn) => {
      _handleIncomingConnection(conn);
    });

    _peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      reject(err);
    });
  });
}

export async function joinRoom(roomCode, playerName) {
  return new Promise((resolve, reject) => {
    _peer = new Peer();
    _peer.on('open', (id) => {
      _isHost = false;
      _roomCode = roomCode;

      _store.dispatch({
        type: Actions.MP.CONNECT,
        payload: { peerId: id, isHost: false, playerName, roomCode }
      });

      const conn = _peer.connect(roomCode);
      _handleOutgoingConnection(conn, playerName);
      
      conn.on('open', () => {
        resolve(id);
      });
    });

    _peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      reject(err);
    });
  });
}

export function leaveRoom() {
  if (_peer) {
    _peer.destroy();
    _peer = null;
  }
  _connections.clear();
  _isHost = false;
  _roomCode = null;
  _store.dispatch({ type: Actions.MP.DISCONNECT });
}

export function isConnected() {
  return _peer && !_peer.destroyed;
}

export function broadcastAction(action) {
  _broadcast({ ...action, _mpOrigin: true });
}

// --- Internal Helpers ---

function _handleIncomingConnection(conn) {
  conn.on('data', (data) => {
    if (data.type === 'JOIN_REQUEST') {
      _connections.set(conn.peer, conn);

      const state = _store.getState();
      const disconnectedPeer = state.multiplayer.peers.find(
        p => p.playerId && p.playerId === data.playerId && p.connected === false
      );

      if (disconnectedPeer) {
        // Rejoin: restore the old slot with the new peerId
        _store.dispatch({
          type: Actions.MP.PEER_REJOINED,
          payload: { peerId: conn.peer, playerId: data.playerId }
        });
        _broadcast({
          type: Actions.MP.PEER_REJOINED,
          payload: { peerId: conn.peer, playerId: data.playerId },
          _mpOrigin: true
        });
      } else {
        // New join: assign color and add
        const guestColor = assignColor(state.multiplayer.peers.length);
        _store.dispatch({
          type: Actions.MP.PEER_JOINED,
          payload: { peerId: conn.peer, name: data.playerName, isHost: false, color: guestColor, playerId: data.playerId }
        });
        _broadcast({
          type: Actions.MP.PEER_JOINED,
          payload: { peerId: conn.peer, name: data.playerName, isHost: false, color: guestColor, playerId: data.playerId },
          _mpOrigin: true
        });
      }

      setTimeout(() => {
        const freshState = _store.getState();
        const mp = freshState.multiplayer;
        const hostInPeers = mp.peers.find(p => p.id === mp.peerId);
        const peers = hostInPeers
          ? mp.peers
          : [
              ...mp.peers,
              {
                id: mp.peerId,
                name: mp.playerName,
                isHost: true,
                connected: true,
                color: mp.peers.find(p => p.isHost)?.color || assignColor(0),
                confirmed: false
              }
            ];
        conn.send({
          type: 'INITIAL_SYNC',
          payload: {
            gameState: freshState.game,
            mpMode: mp.mpMode,
            peers,
            lobbyConfig: mp.lobbyConfig,
            status: mp.status
          }
        });
      }, 500);
    } else if (data._mpOrigin) {
      // Received action from guest
      _handleRemoteActionFromGuest(data);
    }
  });

  conn.on('close', () => {
    _connections.delete(conn.peer);
    _store.dispatch({ type: Actions.MP.PEER_LEFT, payload: { peerId: conn.peer } });
  });
}

function _handleOutgoingConnection(conn, playerName) {
  conn.on('open', () => {
    _connections.set(conn.peer, conn);
    conn.send({ type: 'JOIN_REQUEST', playerName, playerId: getPlayerId() });
  });

  conn.on('data', (data) => {
    if (data.type === 'INITIAL_SYNC') {
      const status = data.payload.status || 'LOBBY';
      let gameState = data.payload.gameState;
      if (data.payload.mpMode === 'COMPETITIVE' && status === 'PLAYING' && gameState?.cells) {
        // Strip opponent's placements — guest needs a blank board to fill independently
        gameState = {
          ...gameState,
          cells: gameState.cells.map(c => c.fixed ? c : { ...c, v: 0, c: [] })
        };
      }
      _store.dispatch({
        type: Actions.MP.SYNC_STATE,
        payload: { gameState }
      });
      const localPeerId = _store.getState().multiplayer.peerId;
      data.payload.peers.forEach(p => {
        if (p.id === localPeerId) return; // own entry already set by MP/CONNECT
        _store.dispatch({
          type: Actions.MP.PEER_JOINED,
          payload: { peerId: p.id, name: p.name, isHost: p.isHost, color: p.color, playerId: p.playerId }
        });
      });
      if (data.payload.lobbyConfig) {
        _store.dispatch({ type: 'MP/UPDATE_LOBBY_CONFIG', payload: data.payload.lobbyConfig });
      }
      _store.dispatch({ type: Actions.MP.SET_STATUS, payload: { status, mpMode: data.payload.mpMode } });
      _store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: status === 'PLAYING' ? 'GAME' : 'LOBBY' } });
    } else if (data.type === Actions.MP.ACTION_REJECTED) {
      _store.dispatch({ type: Actions.UI.FLASH_CELL, payload: { id: data.payload.cellId, flashType: 'conflict' } });
    } else if (data._mpOrigin) {
      // Don't re-apply actions we sent ourselves
      if (data._mp?.peerId === _store.getState().multiplayer.peerId) return;
      _store.dispatch(data);
      if (data.type === Actions.GAME.START) {
        _store.dispatch({ type: Actions.MP.SET_STATUS, payload: { status: 'PLAYING', mpMode: data.payload.mpMode } });
        _store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });
      }
    }
  });

  conn.on('close', () => {
    _connections.delete(conn.peer);
    _store.dispatch({ type: Actions.MP.DISCONNECT });
  });
}

function _handleLocalActionHost(state, action) {
  _lastActionSequence++;
  const syncAction = {
    ...action,
    _mpOrigin: true,
    _mp: { peerId: state.multiplayer.peerId, sequence: _lastActionSequence }
  };
  _broadcast(syncAction);

  if (action.type === Actions.GAME.START) {
    _store.dispatch({ type: Actions.MP.SET_STATUS, payload: { status: 'PLAYING' } });
    _store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'GAME' } });
  }
}

function _handleLocalActionGuest(state, action) {
  _lastActionSequence++;
  const syncAction = {
    ...action,
    _mpOrigin: true,
    _mp: { peerId: state.multiplayer.peerId, sequence: _lastActionSequence }
  };
  
  // Send to host
  const hostConn = _connections.get(_roomCode);
  if (hostConn) {
    hostConn.send(syncAction);
  }
}

function _handleRemoteActionFromGuest(action) {
  if (action.type === Actions.MP.GUEST_CONFIRM) {
    _store.dispatch(action);
    _broadcast(action);
    return;
  }

  // Apply locally
  _store.dispatch(action);

  // Broadcast to other guests
  _broadcast(action);
}

function _broadcast(data) {
  _connections.forEach(conn => {
    if (conn.open) {
      conn.send(data);
    }
  });
}
