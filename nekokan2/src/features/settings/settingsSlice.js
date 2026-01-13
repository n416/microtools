import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  areas: [
    { id: 'terraguard', name: 'テラガード', theme: 'gray' },
    { id: 'turia', name: 'トゥリア', theme: 'pink' },
    { id: 'angelos', name: 'アンゲロス', theme: 'orange' },
    { id: 'fontunas', name: 'フォントゥナス', theme: 'purple' },
    { id: 'monbera', name: 'モンベラ', theme: 'silver' },
    { id: 'abaddon', name: 'アバドン', theme: 'wheat' }, // Added
  ],
  defaultChannelCount: 6,
};

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // 将来的な設定変更用
    updateChannelCount: (state, action) => {
        state.defaultChannelCount = action.payload;
    }
  },
});

export default settingsSlice.reducer;
