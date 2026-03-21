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

    // Candidate actions are derived from each player's local settings.
    // In competitive mode each board is independent so never sync them.
    // In co-op the board is shared so they must sync.
    const isCandidateAction = action.type === 'BOARD/SET_ALL_CANDIDATES' ||
                              action.type === 'BOARD/RESTORE_MANUAL_CANDIDATES';
    if (isCandidateAction && state.multiplayer?.mpMode === 'COMPETITIVE') return;

    if (_isHost) {
      _handleLocalActionHost(state, action);
    } else if (_peer && !state.multiplayer.isHost && state.multiplayer.status !== 'DISCONNECTED') {
      _handleLocalActionGuest(state, action);
    }
  });
}

async function getIceServers() {
  const isLocal = window.location.hostname === "localhost" ||
                  window.location.hostname === "127.0.0.1" ||
                  window.location.hostname.startsWith("192.168.");
  if (isLocal) {
    console.log("Localhost detected: Skipping TURN server to save quota.");
    return [];
  }

  const res = await fetch("https://websiteapiworker.abemicheljob.workers.dev/");
  if (!res.ok) throw new Error("Failed to fetch ICE servers.");
  
  const data = await res.json();
  const rawServers = Array.isArray(data) ? data : data.iceServers;

  // --- FILTERING LOGIC ---
  // We prioritize: 1 STUN, 1 TURN (UDP), and 1 TURN (TLS/443) for firewalls.
  const filtered = [];
  
  // 1. Keep a standard STUN server (usually just one is needed)
  const stun = rawServers.find(s => s.urls.includes("stun:"));
  if (stun) filtered.push(stun);

  // 2. Keep a TURN UDP server (Fastest for gaming)
  const turnUDP = rawServers.find(s => s.urls.includes("turn:") && !s.urls.includes("transport=tcp"));
  if (turnUDP) filtered.push(turnUDP);

  // 3. Keep a TURN TLS/TCP server (Best for school/office firewalls)
  const turnTLS = rawServers.find(s => s.urls.includes("443") || s.urls.includes("transport=tcp"));
  if (turnTLS && turnTLS !== turnUDP) filtered.push(turnTLS);

  console.log("Reduced ICE Servers from", rawServers.length, "to", filtered.length);
  return filtered;
}

export async function createRoom(playerName, mpMode, gameConfig, attempt = 1) {
  const MAX_ATTEMPTS = 5;

  return new Promise(async (resolve, reject) => {
    try {
      const data = await getIceServers();
      const iceServers = Array.isArray(data) ? data : data.iceServers;
      
      const roomCode = generateRoomCode();
      console.log(`Attempt ${attempt}: Trying room code ${roomCode}`);

      _peer = new Peer(roomCode, { 
        config: { iceServers } 
      });

      _peer.on('open', (id) => {
        _isHost = true;
        _roomCode = id;
        
        // Dispatching your initial state logic
        _store.dispatch({
          type: Actions.MP.CONNECT,
          payload: { peerId: id, isHost: true, playerName, roomCode: id, mpMode }
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
        // Check if the ID is taken
        if (err.type === 'unavailable-id') {
          console.warn(`Room code ${roomCode} is taken.`);
          
          if (attempt < MAX_ATTEMPTS) {
            // Cleanup the failed peer instance before retrying
            _peer.destroy(); 
            // Retry recursively
            resolve(createRoom(playerName, mpMode, gameConfig, attempt + 1));
          } else {
            reject(new Error("Failed to find an available room code after several attempts."));
          }
        } else {
          // Other types of errors (Network, etc.) should just fail
          console.error('PeerJS fatal error:', err);
          reject(err);
        }
      });

    } catch (err) {
      console.error("Setup failed:", err);
      reject(err);
    }
  });
}

export async function joinRoom(roomCode, playerName) {
  return new Promise(async (resolve, reject) => {
    try {
      // FIX: Ensure iceServers is an array, not {iceServers: []}
      const data = await getIceServers();
      const iceServers = Array.isArray(data) ? data : data.iceServers;

      _peer = new Peer({ 
        config: { iceServers: iceServers } 
      });
    } catch (err) {
      reject(err);
      return;
    }

    _peer.on('open', (id) => {
      _isHost = false;
      _roomCode = roomCode;

      _store.dispatch({
        type: Actions.MP.CONNECT,
        payload: { peerId: id, isHost: false, playerName, roomCode }
      });

      // Initiate connection to host
      const conn = _peer.connect(roomCode);
      _handleOutgoingConnection(conn, playerName);
      
      // FIX: Listen for the specific connection to open, not just the peer
      conn.on('open', () => {
        console.log("Connected to host successfully");
        resolve(id);
      });

      conn.on('error', (err) => {
        reject(new Error("Failed to connect to room: " + err));
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
        payload: { gameState },
        _mpOrigin: true
      });
      const localPeerId = _store.getState().multiplayer.peerId;
      data.payload.peers.forEach(p => {
        if (p.id === localPeerId) return; // own entry already set by MP/CONNECT
        _store.dispatch({
          type: Actions.MP.PEER_JOINED,
          payload: { peerId: p.id, name: p.name, isHost: p.isHost, color: p.color, playerId: p.playerId },
          _mpOrigin: true
        });
      });
      if (data.payload.lobbyConfig) {
        _store.dispatch({ type: 'MP/UPDATE_LOBBY_CONFIG', payload: data.payload.lobbyConfig, _mpOrigin: true });
      }
      _store.dispatch({ type: Actions.MP.SET_STATUS, payload: { status, mpMode: data.payload.mpMode }, _mpOrigin: true });
      _store.dispatch({ type: Actions.UI.SET_VIEW, payload: { view: status === 'PLAYING' ? 'GAME' : 'LOBBY' }, _mpOrigin: true });
    } else if (data.type === Actions.MP.ACTION_REJECTED) {
      _store.dispatch({ type: Actions.UI.FLASH_CELL, payload: { id: data.payload.cellId, flashType: 'conflict' }, _mpOrigin: true });
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
