import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  entries: [], // { id, area, channel, time, timestamp }
};

export const logsSlice = createSlice({
  name: 'logs',
  initialState,
  reducers: {
    addLog: (state, action) => {
      const { area, channel, time } = action.payload;
      state.entries.push({
        id: Date.now(), // 簡易ID
        area,
        channel,
        time,
        timestamp: new Date().toISOString()
      });
      // 時刻順などでソートが必要ならここで処理
      state.entries.sort((a, b) => a.time.localeCompare(b.time));
    },
    clearLogs: (state) => {
      state.entries = [];
    },
    removeLog: (state, action) => {
        const idToRemove = action.payload;
        state.entries = state.entries.filter(entry => entry.id !== idToRemove);
    }
  },
});

export const { addLog, clearLogs, removeLog } = logsSlice.actions;
export default logsSlice.reducer;
