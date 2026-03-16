export const Actions = Object.freeze({
  BOARD: {
    SET_VALUE: 'BOARD/SET_VALUE',
    SET_CANDIDATE: 'BOARD/SET_CANDIDATE',
    CLEAR_CELL: 'BOARD/CLEAR_CELL',
    MOVE_PIECE: 'BOARD/MOVE_PIECE',
    CLEAR_PLACED_BY: 'BOARD/CLEAR_PLACED_BY',
  },
  GAME: {
    START: 'GAME/START',
    LOAD_DAILY: 'GAME/LOAD_DAILY',
    RESET: 'GAME/RESET',
    TICK: 'GAME/TICK',
    PAUSE: 'GAME/PAUSE',
    RESUME: 'GAME/RESUME',
    HINT: 'GAME/HINT',
    WIN: 'GAME/WIN',
  },
  UI: {
    SELECT_CELL: 'UI/SELECT_CELL',
    SET_INPUT_MODE: 'UI/SET_INPUT_MODE',
    SET_VIEW: 'UI/SET_VIEW',
    OPEN_MODAL: 'UI/OPEN_MODAL',
    CLOSE_MODAL: 'UI/CLOSE_MODAL',
    FLASH_CELL: 'UI/FLASH_CELL',
    CLEAR_FLASH: 'UI/CLEAR_FLASH',
  },
  MP: {
    CONNECT: 'MP/CONNECT',
    PEER_JOINED: 'MP/PEER_JOINED',
    PEER_LEFT: 'MP/PEER_LEFT',
    PEER_SYNC: 'MP/PEER_SYNC',
    DISCONNECT: 'MP/DISCONNECT',
    SET_PLAYER_NAME: 'MP/SET_PLAYER_NAME',
    SET_STATUS: 'MP/SET_STATUS',
    SET_OPPONENT_BOARD: 'MP/SET_OPPONENT_BOARD',
    ACTION_REJECTED: 'MP/ACTION_REJECTED',
    SYNC_STATE: 'MP/SYNC_STATE',
    GUEST_CONFIRM: 'MP/GUEST_CONFIRM',
  },
  MOD: {
    TRIGGER: 'MOD/TRIGGER',
    TICK: 'MOD/TICK',
  },
  SYSTEM: {
    SETTINGS_UPDATE: 'SETTINGS/UPDATE',
    STATS_UPDATE: 'STATS/UPDATE',
    ACHIEVEMENTS_UNLOCK: 'ACHIEVEMENTS/UNLOCK',
  },
  HISTORY: {
    UNDO: 'HISTORY/UNDO',
    REDO: 'HISTORY/REDO',
  },
  RECON: {
    PICK_UP_PIECE: 'RECON/PICK_UP_PIECE',
    PLACE_PIECE: 'RECON/PLACE_PIECE',
    RETURN_PIECE: 'RECON/RETURN_PIECE',
    ROTATE_PIECE: 'RECON/ROTATE_PIECE',
    MIRROR_PIECE: 'RECON/MIRROR_PIECE',
    SELECT_PIECE: 'RECON/SELECT_PIECE',
    RETURN_TO_TRAY: 'RECON/RETURN_TO_TRAY',
  }
});

// Board Actions
export const setValueAction = (id, value) => ({ type: Actions.BOARD.SET_VALUE, payload: { id, value } });
export const setCandidateAction = (id, value) => ({ type: Actions.BOARD.SET_CANDIDATE, payload: { id, value } });
export const clearCellAction = (id) => ({ type: Actions.BOARD.CLEAR_CELL, payload: { id } });
export const movePieceAction = (pieceId, position) => ({ type: Actions.BOARD.MOVE_PIECE, payload: { pieceId, position } });
export const clearPlacedByAction = (id) => ({ type: Actions.BOARD.CLEAR_PLACED_BY, payload: { id } });

// Game Actions
export const startGameAction = (seed, difficulty, mode) => ({ type: Actions.GAME.START, payload: { seed, difficulty, mode } });
export const loadDailyAction = (date) => ({ type: Actions.GAME.LOAD_DAILY, payload: { date } });
export const resetGameAction = () => ({ type: Actions.GAME.RESET });
export const tickAction = (elapsed) => ({ type: Actions.GAME.TICK, payload: { elapsed } });
export const pauseGameAction = () => ({ type: Actions.GAME.PAUSE });
export const resumeGameAction = () => ({ type: Actions.GAME.RESUME });
export const hintAction = (level) => ({ type: Actions.GAME.HINT, payload: { level } });
export const winGameAction = () => ({ type: Actions.GAME.WIN });

// UI Actions
export const selectCellAction = (id) => ({ type: Actions.UI.SELECT_CELL, payload: { id } });
export const setInputModeAction = (mode) => ({ type: Actions.UI.SET_INPUT_MODE, payload: { mode } });
export const setViewAction = (view) => ({ type: Actions.UI.SET_VIEW, payload: { view } });
export const openModalAction = (modal) => ({ type: Actions.UI.OPEN_MODAL, payload: { modal } });
export const closeModalAction = () => ({ type: Actions.UI.CLOSE_MODAL });
export const flashCellAction = (id, flashType = 'conflict') => ({ type: Actions.UI.FLASH_CELL, payload: { id, flashType } });
export const clearFlashAction = (id) => ({ type: Actions.UI.CLEAR_FLASH, payload: { id } });

// MP Actions
export const mpConnectAction = (peerId, isHost, playerName, roomCode) => ({ 
  type: Actions.MP.CONNECT, 
  payload: { peerId, isHost, playerName, roomCode } 
});
export const mpPeerJoinedAction = (peerId, name, isHost = false) => ({ 
  type: Actions.MP.PEER_JOINED, 
  payload: { peerId, name, isHost } 
});
export const mpPeerLeftAction = (peerId) => ({ type: Actions.MP.PEER_LEFT, payload: { peerId } });
export const mpPeerSyncAction = (action) => ({ type: Actions.MP.PEER_SYNC, payload: { action } });
export const mpDisconnectAction = () => ({ type: Actions.MP.DISCONNECT });
export const mpSetPlayerNameAction = (name) => ({ type: Actions.MP.SET_PLAYER_NAME, payload: { name } });
export const mpSetStatusAction = (status) => ({ type: Actions.MP.SET_STATUS, payload: { status } });
export const mpSetOpponentBoardAction = (peerId, filledCount, totalCells) => ({ 
  type: Actions.MP.SET_OPPONENT_BOARD, 
  payload: { peerId, filledCount, totalCells } 
});
export const mpActionRejectedAction = (cellId) => ({ type: Actions.MP.ACTION_REJECTED, payload: { cellId } });
export const mpSyncStateAction = (gameState) => ({ type: Actions.MP.SYNC_STATE, payload: { gameState } });
export const mpGuestConfirmAction = (peerId, confirmed) => ({ type: Actions.MP.GUEST_CONFIRM, payload: { peerId, confirmed } });

// Modifier Actions
export const modTriggerAction = (modifierId, payload) => ({ type: Actions.MOD.TRIGGER, payload: { modifierId, ...payload } });
export const modTickAction = () => ({ type: Actions.MOD.TICK });

// System Actions
export const settingsUpdateAction = (settings) => ({ type: Actions.SYSTEM.SETTINGS_UPDATE, payload: { settings } });
export const statsUpdateAction = (stats) => ({ type: Actions.SYSTEM.STATS_UPDATE, payload: { stats } });
export const achievementsUnlockAction = (id) => ({ type: Actions.SYSTEM.ACHIEVEMENTS_UNLOCK, payload: { id } });

// History Actions
export const undoAction = () => ({ type: Actions.HISTORY.UNDO });
export const redoAction = () => ({ type: Actions.HISTORY.REDO });

// Recon Actions
export const pickUpPieceAction = (pieceId) => ({ type: Actions.RECON.PICK_UP_PIECE, payload: { pieceId } });
export const placePieceAction = (pieceId, boardRow, boardCol, rotation, mirrored) => ({ 
  type: Actions.RECON.PLACE_PIECE, 
  payload: { pieceId, boardRow, boardCol, rotation, mirrored } 
});
export const returnPieceAction = (pieceId) => ({ type: Actions.RECON.RETURN_PIECE, payload: { pieceId } });
export const rotatePieceAction = (pieceId, direction) => ({ type: Actions.RECON.ROTATE_PIECE, payload: { pieceId, direction } });
export const mirrorPieceAction = (pieceId) => ({ type: Actions.RECON.MIRROR_PIECE, payload: { pieceId } });
export const selectPieceAction = (pieceId) => ({ type: Actions.RECON.SELECT_PIECE, payload: { pieceId } });
export const returnToTrayAction = (pieceId) => ({ type: Actions.RECON.RETURN_TO_TRAY, payload: { pieceId } });
