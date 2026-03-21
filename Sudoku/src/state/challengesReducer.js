import { Actions } from '../core/actions.js';

const defaultState = {
  challenges: {}, // { challengeId: { status: 'not_attempted' | 'in_progress' | 'completed', gameState: null, lastUpdated: Date } }
  lastDailyDate: null // 'YYYY-MM-DD'
};

export const challengesReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.CHALLENGE.UPDATE_STATUS: {
      const { id, status, gameState } = action.payload;
      return {
        ...state,
        challenges: {
          ...state.challenges,
          [id]: {
            ...state.challenges[id],
            status,
            gameState,
            lastUpdated: new Date().toISOString()
          }
        }
      };
    }

    case Actions.CHALLENGE.CLEAR_DAILIES: {
      const { currentDate } = action.payload;
      if (state.lastDailyDate === currentDate) return state;

      const newChallenges = { ...state.challenges };
      // Clear all challenges that are part of the 'daily' category (we'll check by ID prefix or just clear all with 'daily' in ID)
      Object.keys(newChallenges).forEach(id => {
        if (id.startsWith('daily_')) {
          delete newChallenges[id];
        }
      });

      return {
        ...state,
        challenges: newChallenges,
        lastDailyDate: currentDate
      };
    }

    case Actions.CHALLENGE.SYNC_ALL:
      return { ...state, ...action.payload };

    default:
      return state;
  }
};
