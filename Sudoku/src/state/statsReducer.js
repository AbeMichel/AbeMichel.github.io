import { Actions } from '../core/actions.js';

const defaultState = { 
  streaks: 0, 
  bestTimes: {}, 
  hintsUsed: 0, 
  totalSolved: 0 
};

export const statsReducer = (state = defaultState, action) => {
  switch (action.type) {
    case Actions.SYSTEM.STATS_UPDATE:
      return { ...state, ...action.payload.stats };
    default:
      return state;
  }
};
