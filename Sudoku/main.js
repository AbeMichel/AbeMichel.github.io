import { createStore } from './src/core/store.js';
import { rootReducer } from './src/core/reducer.js';
import { initTimer } from './src/services/timer.js';
import { initPersistence, loadPersistedState } from './src/services/persistence.js';
import { initAchievements } from './src/services/achievements.js';
import { initHints } from './src/services/hints.js';
import { initGameEffects } from './src/services/gameEffects.js';
import { initMultiplayer } from './src/services/multiplayer.js';
import { initCompetitiveEffects } from './src/services/competitiveEffects.js';
import { setStore } from './src/components/app-root.js';

// 1. Load Persisted State
const persistedState = loadPersistedState();

// 2. Create Store
export const store = createStore(rootReducer, persistedState);
window.__store = store;

// 3. Wires up App Root
setStore(store);

if (persistedState.playerName) {
  store.dispatch({ type: 'MP/SET_PLAYER_NAME', payload: { name: persistedState.playerName } });
}

// 3b. Persist settings on change
store.subscribe((state, action) => {
  if (action?.type === 'SETTINGS/SET' || action?.type === 'SETTINGS/UPDATE') {
    try {
      localStorage.setItem('sudoku_settings', JSON.stringify(state.settings));
    } catch {}
  }
});

// 4. Initialize Services
initTimer(store);
initPersistence(store);
initAchievements(store);
initHints(store);
initGameEffects(store);
initMultiplayer(store);
initCompetitiveEffects(store);

// 5. Initial View
store.dispatch({ type: 'UI/SET_VIEW', payload: { view: 'TITLE' } });

