import { Actions } from '../core/actions.js';
import { broadcastAction } from './multiplayer.js';
import { getConflictIds } from '../utils/boardGeometry.js';

export const initCompetitiveEffects = (store) => {
  store.subscribe((state, action) => {
    if (!action) return;

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
          { peerId, name: state.multiplayer.playerName, time: finishTime, mistakes, finished: true },
          ...state.multiplayer.peers.map(p => {
            const cb = state.multiplayer.competitiveBoards[p.id] || {};
            return {
              peerId: p.id,
              name: p.name,
              time: cb.finishTime,
              mistakes: cb.mistakes ?? 0,
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
