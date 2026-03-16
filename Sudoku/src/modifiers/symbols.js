export const SymbolsModifier = {
  id: 'SYMBOLS',

  onAction: (state, action, dispatch) => action,

  initialModState: () => ({ 
    symbols: ['🔥', '💧', '🌿', '⚡', '🌙', '☀️', '🌊', '🍄', '⭐'] 
  }),

  getCssClasses: (state) => ['mod-symbols']
};

export const getSymbol = (state, digit) => {
  const modState = state.modifiers.modState['SYMBOLS'];
  if (!modState || !modState.symbols || digit < 1 || digit > 9) return digit;
  return modState.symbols[digit - 1];
};
