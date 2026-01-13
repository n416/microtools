import { configureStore } from '@reduxjs/toolkit';
import nekokanReducer, { loadInitialState } from '../features/nekokanSlice';

// ミドルウェア: 状態変更時にlocalStorageへ保存
const localStorageMiddleware = store => next => action => {
  const result = next(action);
  const state = store.getState().nekokan;
  
  if (action.type.startsWith('nekokan/')) {
    localStorage.setItem('logs', JSON.stringify(state.logs));
    localStorage.setItem('timeDisplays', JSON.stringify(state.timeDisplays));
    localStorage.setItem('disabledChannels', JSON.stringify(state.disabledChannels));
    localStorage.setItem('channelSettings', JSON.stringify(state.channelCounts));
    localStorage.setItem('defaultChannelCount', state.defaultChannelCount);
    localStorage.setItem('secondsDisplayState', JSON.stringify(state.showSeconds));
    localStorage.setItem('hideTimeState', JSON.stringify(state.hideTime));
    localStorage.setItem('alarmCheckboxesState', JSON.stringify(state.alarmSettings));
  }
  return result;
};

export const store = configureStore({
  reducer: {
    nekokan: nekokanReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(localStorageMiddleware),
});

// 初期化時にデータをロード
store.dispatch(loadInitialState());
