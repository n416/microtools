import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';

const getInitialWriteTokens = (): { [serverId: string]: string } => {
  try {
    const item = sessionStorage.getItem('writeTokens');
    // --- ★★★ 調査用ログを追加 ★★★ ---
    console.log('%c[authSlice] アプリケーション起動: sessionStorageからトークンを読み込みます。', 'color: green; font-weight: bold;');
    console.log('[authSlice] 読み込んだトークン:', item ? JSON.parse(item) : 'なし');
    // --- ★★★ ここまで追加 ★★★ ---
    return item ? JSON.parse(item) : {};
  } catch (error) {
    console.error('Could not parse writeTokens from sessionStorage:', error);
    return {};
  }
};

interface AuthState {
  writeTokens: { [serverId: string]: string };
}

const initialState: AuthState = {
  writeTokens: getInitialWriteTokens(),
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setWriteToken: (state, action: PayloadAction<{ serverId: string; token: string }>) => {
      const { serverId, token } = action.payload;
      // --- ★★★ 調査用ログを追加 ★★★ ---
      console.log('%c[authSlice] setWriteTokenが呼ばれました。', 'color: green; font-weight: bold;');
      console.log('[authSlice] 保存するサーバーID:', serverId);
      console.log('[authSlice] 保存するトークン:', token);
      // --- ★★★ ここまで追加 ★★★ ---
      state.writeTokens[serverId] = token;
      try {
        sessionStorage.setItem('writeTokens', JSON.stringify(state.writeTokens));
        console.log('[authSlice] sessionStorageへの保存が成功しました。現在の内容:', state.writeTokens);
      } catch (error) {
        console.error('Could not save writeTokens to sessionStorage:', error);
      }
    },
    clearWriteTokens: (state) => {
      // --- ★★★ 調査用ログを追加 ★★★ ---
      console.log('%c[authSlice] clearWriteTokensが呼ばれました。', 'color: red; font-weight: bold;');
      // --- ★★★ ここまで追加 ★★★ ---
      state.writeTokens = {};
      try {
        sessionStorage.removeItem('writeTokens');
      } catch (error) {
        console.error('Could not remove writeTokens from sessionStorage:', error);
      }
    },
  },
});

export const { setWriteToken, clearWriteTokens } = authSlice.actions;

export const selectWriteTokenForServer = (serverId: string) => (state: RootState) => state.auth.writeTokens[serverId];

export default authSlice.reducer;