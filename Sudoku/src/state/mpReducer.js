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
  actionSequence: 0,     // incremented on every synced action
  error: null
};

export const mpReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.MP.CONNECT:
      return {
        ...state,
        peerId: action.payload.peerId,
        isHost: action.payload.isHost,
        playerName: action.payload.playerName,
        roomCode: action.payload.roomCode,
        mpMode: action.payload.mpMode || null,
        status: 'CONNECTING'
      };

    case Actions.MP.PEER_JOINED: {
      // Avoid duplicates
      if (state.peers.find(p => p.id === action.payload.peerId)) return state;
      return {
        ...state,
        peers: [...state.peers, {
          id: action.payload.peerId,
          name: action.payload.name,
          isHost: action.payload.isHost,
          connected: true,
          color: action.payload.color || assignColor(state.peers.length),
          confirmed: false
        }]
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
      return { ...defaultState };

    case Actions.MP.SET_PLAYER_NAME:
      return { ...state, playerName: action.payload.name };

    case Actions.MP.SET_STATUS:
      return { 
        ...state, 
        status: action.payload.status, 
        ...(action.payload.mpMode ? { mpMode: action.payload.mpMode } : {}) 
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

    default:
      return state;
  }
};
