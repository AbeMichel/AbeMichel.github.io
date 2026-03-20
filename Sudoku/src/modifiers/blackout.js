import { Actions, modTriggerAction } from '../core/actions.js';

const getCellsInScope = (cellId, scope) => {
  const row = Math.floor(cellId / 9);
  const col = cellId % 9;
  if (scope === 'CROSS') {
    const ids = [];
    for (let c = 0; c < 9; c++) ids.push(row * 9 + c);
    for (let r = 0; r < 9; r++) ids.push(r * 9 + col);
    return ids;
  }
  if (scope === 'BOX') {
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    const ids = [];
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++)
        ids.push((boxRow + r) * 9 + (boxCol + c));
    return ids;
  }
  return [cellId];
};

export const BlackoutModifier = {
  id: 'BLACKOUT',

  onAction: (state, action, dispatch) => {
    if (action.type === Actions.UI.SELECT_CELL) {
      const selectedId = action.payload.id;
      const modState = state.modifiers.modState['BLACKOUT'];
      if (!modState) return action;

      const scope = modState.revealScope || 'CELL';
      const toReveal = (selectedId === null) ? [] : getCellsInScope(selectedId, scope);
      
      // Only dispatch if revealed cells actually change
      const current = modState.revealed || [];
      if (toReveal.length !== current.length || !toReveal.every(id => current.includes(id))) {
        dispatch(modTriggerAction('BLACKOUT', { revealed: toReveal }));
      }
    }
    return action;
  },

  initialModState: () => ({
    revealed: [],
    revealScope: 'CELL'
  }),

  getCssClasses: (state) => ['mod-blackout']
};
