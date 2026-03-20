import { Actions } from '../core/actions.js';
import { assignColor } from '../config/multiplayerColors.js';

const defaultState = {
  peerId: null,
  roomCode: null,
  isHost: false,
  playerName: '',
  peers: [],             // [{ id, name, isHost, connected, color, confirmed }]
  mpMode: null,          // 'CO_OP' | 'COMPETITIVE' | 'VERSUS' | null
  versusMode: null,      // versus variant id for future use
  status: 'DISCONNECTED', // 'DISCONNECTED' | 'CONNECTING' | 'LOBBY' | 'PLAYING'
  opponentBoards: {},    // { [peerId]: { filledCount, totalCells } } for COMPETITIVE
  competitiveBoards: {}, // { [peerId]: { cells, filledCount, finished, finishTime } }
  lastConfig: null,
  lobbyConfig: { mpMode: 'CO_OP', difficulty: 'MEDIUM' },
  actionSequence: 0,     // incremented on every synced action
  error: null
};

export const mpReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.MP.CONNECT: {
      const selfPeer = {
        id: action.payload.peerId,
        name: action.payload.playerName,
        isHost: action.payload.isHost,
        connected: true,
        color: assignColor(0),
        confirmed: false,
        playerId: null
      };
      return {
        ...state,
        peerId: action.payload.peerId,
        isHost: action.payload.isHost,
        playerName: action.payload.playerName,
        roomCode: action.payload.roomCode,
        mpMode: action.payload.mpMode || null,
        status: 'CONNECTING',
        peers: [selfPeer],
        competitiveBoards: {},
        lastConfig: null,
        error: null
      };
    }

    case Actions.MP.PEER_JOINED: {
      const existing = state.peers.find(p => p.id === action.payload.peerId);
      if (existing) {
        // Update host-assigned fields that weren't available at CONNECT time
        return {
          ...state,
          peers: state.peers.map(p => p.id === action.payload.peerId
            ? { ...p,
                color: action.payload.color ?? p.color,
                playerId: action.payload.playerId ?? p.playerId
              }
            : p
          )
        };
      }
      return {
        ...state,
        peers: [...state.peers, {
          id: action.payload.peerId,
          name: action.payload.name,
          isHost: action.payload.isHost,
          connected: true,
          color: action.payload.color ?? assignColor(state.peers.length),
          confirmed: false,
          playerId: action.payload.playerId || null
        }]
      };
    }

    case Actions.MP.PEER_REJOINED: {
      const { peerId, playerId } = action.payload;
      return {
        ...state,
        peers: state.peers.map(p =>
          p.playerId === playerId ? { ...p, id: peerId, connected: true } : p
        )
      };
    }

    case Actions.MP.GUEST_CONFIRM:
      return {
        ...state,
        peers: state.peers.map(p => 
          p.id === action.payload.peerId ? { ...p, confirmed: action.payload.confirmed } : p
        )
      };

    case Actions.MP.PEER_LEFT:
      return {
        ...state,
        peers: state.peers.map(p => 
          p.id === action.payload.peerId ? { ...p, connected: false } : p
        )
      };

    case Actions.MP.DISCONNECT:
      return { ...defaultState, playerName: state.playerName };

    case 'MP/SET_ERROR':
      return { ...state, error: action.payload };

    case Actions.MP.SET_PLAYER_NAME:
      return { ...state, playerName: action.payload.name };

    case Actions.MP.SET_STATUS:
      return { 
        ...state, 
        status: action.payload.status, 
        ...(action.payload.mpMode ? { mpMode: action.payload.mpMode } : {}) 
      };

    case 'MP/UPDATE_LOBBY_CONFIG':
      return {
        ...state,
        lobbyConfig: { ...state.lobbyConfig, ...action.payload }
      };

    case Actions.MP.SET_OPPONENT_BOARD:
      return {
        ...state,
        opponentBoards: {
          ...state.opponentBoards,
          [action.payload.peerId]: {
            filledCount: action.payload.filledCount,
            totalCells: action.payload.totalCells
          }
        }
      };

    case Actions.MP.SYNC_STATE:
      return state;

    case Actions.MP.ACTION_REJECTED:
      return state;

    case Actions.GAME.START:
      return {
        ...state,
        mpMode: action.payload.mpMode || state.mpMode,
        peers: state.peers.map(p => ({ ...p, confirmed: false }))
      };

    case Actions.MP.RETURN_TO_LOBBY:
      return {
        ...state,
        status: 'LOBBY',
        peers: state.peers.map(p => ({ ...p, confirmed: false }))
      };

    default:
      return state;
  }
};
