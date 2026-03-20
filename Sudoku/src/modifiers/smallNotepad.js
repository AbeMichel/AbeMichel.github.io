import { Actions } from '../core/actions.js';

export const SmallNotepadModifier = {
  id: 'SMALL_NOTEPAD',

  onAction: (state, action, dispatch) => {
    const modState = state.modifiers.modState['SMALL_NOTEPAD'];
    if (!modState) return action;

    if (action.type === Actions.BOARD.SET_CANDIDATE) {
      const { id, value } = action.payload;
      const cell = state.game.cells.find(c => c.id === id);
      // If we're ADDING a candidate, check limit
      if (cell && !(cell.c || []).includes(value)) {
        const total = state.game.cells.reduce((sum, c) => sum + (c.c ? c.c.length : 0), 0);
        if (total >= modState.limit) return null;
      }
    }

    // Truncate auto-candidates to the cap
    if (action.type === Actions.BOARD.SET_ALL_CANDIDATES) {
      const { candidates } = action.payload;
      const flat = [];
      Object.entries(candidates).forEach(([id, list]) => {
        list.forEach(v => flat.push({ id: parseInt(id), v }));
      });
      if (flat.length <= modState.limit) return action;

      // Truncate
      const limited = {};
      flat.slice(0, modState.limit).forEach(item => {
        if (!limited[item.id]) limited[item.id] = [];
        limited[item.id].push(item.v);
      });
      return { ...action, payload: { candidates: limited } };
    }

    // Proactive refill: if a value is placed or a candidate is removed, 
    // trigger a check to see if we can add more candidates to stay at the limit.
    if (action.type === Actions.BOARD.SET_VALUE || action.type === Actions.BOARD.SET_CANDIDATE) {
      // We can't easily refill HERE because we don't know the new state yet
      // But we can dispatch an internal action that gameEffects.js will catch
      setTimeout(() => {
        dispatch({ type: 'INTERNAL/REFRESH_CANDIDATES' });
      }, 0);
    }

    return action;
  },

  initialModState: () => ({ limit: 30 }),

  getCssClasses: (state) => ['mod-small-notepad']
};
