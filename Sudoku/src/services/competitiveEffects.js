import { Actions } from '../core/actions.js';
import { broadcastAction } from './multiplayer.js';
import { getConflictIds } from '../utils/boardGeometry.js';

export const initCompetitiveEffects = (store) => {
  store.subscribe((state, action) => {
    if (!action) return;

    // Vote unanimity check — must run for both local and received votes.
    if (action.type === Actions.COMPETITIVE.CAST_VOTE) {
      const votes = state.ui.competitiveVotes || {};
      const connected = (state.multiplayer.peers || []).filter(p => p.connected !== false);
      if (connected.length > 0 && connected.every(p => votes[p.id] != null)) {
        const first = votes[connected[0].id];
        if (connected.every(p => votes[p.id] === first)) {
          if (first === 'PLAY_AGAIN') {
            store.dispatch({ type: Actions.COMPETITIVE.PLAY_AGAIN });
          } else if (first === 'CHANGE_SETTINGS') {
            // Broadcast so the other player also goes to lobby, since MP/RETURN_TO_LOBBY isn't synced
            broadcastAction({ type: Actions.MP.RETURN_TO_LOBBY });
            store.dispatch({ type: Actions.MP.RETURN_TO_LOBBY });
          }
        }
      }
      return;
    }

    // showWinModal is set by uiReducer on COMPETITIVE/SET_RESULT — no extra dispatch needed.

    if (action._mpOrigin) return;

    const isBoardAction = [Actions.BOARD.SET_VALUE, Actions.BOARD.CLEAR_CELL].includes(action.type);
    
    if (isBoardAction && state.multiplayer.mpMode === 'COMPETITIVE') {
      const { cells, regions, timer, mistakes } = state.game;
      const peerId = state.multiplayer.peerId;

      // 1. Calculate filledCount
      const filledCount = cells.filter(c => !c.fixed && c.v > 0).length;
      const totalToFill = cells.filter(c => !c.fixed).length;
      
      // 2. Check win condition
      const conflicts = getConflictIds(cells, regions);
      const finished = (filledCount === totalToFill) && conflicts.length === 0;
      const finishTime = finished ? timer : null;

      // 3. Broadcast board update to peers
      broadcastAction({
        type: Actions.COMPETITIVE.UPDATE_BOARD,
        payload: { peerId, cells, filledCount, finished, finishTime, mistakes }
      });

      // 4. Handle Win
      if (finished) {
        const results = [
          { peerId, name: state.multiplayer.playerName, time: finishTime, mistakes, filledCount: totalToFill, finished: true },
          ...state.multiplayer.peers
            .filter(p => p.id !== peerId)
            .map(p => {
              const cb = state.multiplayer.competitiveBoards[p.id] || {};
              return {
                peerId: p.id,
                name: p.name,
                time: cb.finishTime,
                mistakes: cb.mistakes ?? 0,
                filledCount: cb.filledCount ?? 0,
                finished: !!cb.finished
              };
            })
        ];

        const winResultAction = {
          type: Actions.COMPETITIVE.SET_RESULT,
          payload: {
            winnerId: peerId,
            winnerName: state.multiplayer.playerName,
            results
          }
        };

        // Local dispatch and broadcast
        store.dispatch(winResultAction);
        broadcastAction(winResultAction);
      }
    }

    if (action.type === Actions.COMPETITIVE.PLAY_AGAIN && state.multiplayer.isHost) {
      const lastConfig = state.multiplayer.lastConfig;
      if (lastConfig) {
        const restartAction = {
          type: Actions.GAME.START,
          payload: { ...lastConfig, seed: Date.now() }
        };
        store.dispatch(restartAction);
        broadcastAction(restartAction);
      }
    }
  });
};
