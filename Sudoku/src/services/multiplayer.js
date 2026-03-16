import Peer from 'https://esm.sh/peerjs@1.5.4';
import { Actions } from '../core/actions.js';
import { assignColor } from '../config/multiplayerColors.js';

let _peer = null;
let _connections = new Map(); // id -> connection
let _store = null;
let _isHost = false;
let _roomCode = null;
let _lastActionSequence = 0;
let _pendingActions = new Map(); // sequence -> action

const SYNCABLE_ACTION_PREFIXES = ['BOARD/', 'RECON/', 'MP/GUEST_CONFIRM'];

export function initMultiplayer(store) {
  _store = store;

  _store.subscribe((state, action) => {
    if (action._mpOrigin) return; // Ignore actions that came from the network

    const isSyncable = SYNCABLE_ACTION_PREFIXES.some(p => action.type.startsWith(p)) || action.type === Actions.GAME.START;
    if (!isSyncable) return;

    if (_isHost) {
      _handleLocalActionHost(state, action);
    } else if (_peer && !state.multiplayer.isHost && state.multiplayer.status !== 'DISCONNECTED') {
      _handleLocalActionGuest(state, action);
    }

    // Competitive mode updates
    if (state.multiplayer.mpMode === 'COMPETITIVE' && action.type.startsWith('BOARD/')) {
      const filledCount = state.game.cells.filter(c => c.v !== 0).length;
      const totalCells = state.game.cells.length;
      const mpAction = {
        type: Actions.MP.SET_OPPONENT_BOARD,
        payload: { peerId: state.multiplayer.peerId, filledCount, totalCells },
        _mpOrigin: true
      };
      _broadcast(mpAction);
    }
  });
}

export async function createRoom(playerName, mpMode, gameConfig) {
  return new Promise((resolve, reject) => {
    _peer = new Peer();
    
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
        }
      });

      _store.dispatch({
        type: Actions.MP.SET_STATUS,
        payload: { status: 'LOBBY' }
      });

      console.log(`Room created! Code: ${id}`);
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

// --- Internal Helpers ---

function _handleIncomingConnection(conn) {
  conn.on('data', (data) => {
    if (data.type === 'JOIN_REQUEST') {
      _connections.set(conn.peer, conn);
      
      setTimeout(() => {
        // Send current state and peer list
        const state = _store.getState();
        conn.send({
          type: 'INITIAL_SYNC',
          payload: {
            gameState: state.game,
            mpMode: state.multiplayer.mpMode,
            peers: state.multiplayer.peers
          }
        });
      }, 500);

      const currentPeerCount = _store.getState().multiplayer.peers.length;
      const guestColor = assignColor(currentPeerCount);
      _store.dispatch({
        type: Actions.MP.PEER_JOINED,
        payload: { peerId: conn.peer, name: data.playerName, isHost: false, color: guestColor }
      });

      _broadcast({
        type: Actions.MP.PEER_JOINED,
        payload: { peerId: conn.peer, name: data.playerName, isHost: false, color: guestColor },
        _mpOrigin: true
      });
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
    conn.send({ type: 'JOIN_REQUEST', playerName });
  });

  conn.on('data', (data) => {
    if (data.type === 'INITIAL_SYNC') {
      _store.dispatch({
        type: Actions.MP.SYNC_STATE,
        payload: { gameState: data.payload.gameState }
      });
      data.payload.peers.forEach(p => {
        _store.dispatch({
          type: Actions.MP.PEER_JOINED,
          payload: { peerId: p.id, name: p.name, isHost: p.isHost, color: p.color }
        });
      });
      _store.dispatch({ type: Actions.MP.SET_STATUS, payload: { status: 'LOBBY' } });
      _store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: 'LOBBY' } });
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
