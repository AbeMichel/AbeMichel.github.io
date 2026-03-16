import { ACHIEVEMENTS } from '../config/achievements.js';
import { Actions } from '../core/actions.js';

export const initAchievements = (store) => {
  store.subscribe((state, action) => {
    // If this WAS an achievements unlock action, don't re-check everything immediately
    // to avoid potential loops, though our guard below handles it.
    if (action.type === Actions.SYSTEM.ACHIEVEMENTS_UNLOCK) return;

    for (const achievement of ACHIEVEMENTS) {
      if (state.achievements.includes(achievement.id)) continue;

      if (achievement.condition(state)) {
        store.dispatch({ 
          type: Actions.SYSTEM.ACHIEVEMENTS_UNLOCK, 
          payload: { id: achievement.id } 
        });
      }
    }
  });
};
