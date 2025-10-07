import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';
import apiClient from '@/api/client';

export interface Server {
  id: string;
  name: string;
  icon: string | null;
  role: 'admin' | 'member';
  // isAddedはAPIから取得するプロパティなので、フロントエンドの型定義からは削除しても良い
  isAdded?: boolean; 
}
interface ServersState {
  servers: Server[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetched: number | null;
}
const initialState: ServersState = {
  servers: [],
  status: 'idle',
  error: null,
  lastFetched: null,
};

export const fetchServers = createAsyncThunk('servers/fetchServers', async () => {
  try {
    const response = await apiClient.get('/servers');
    return response.data as Server[];
  } catch (error) {
    console.warn("APIサーバーへの接続に失敗したため、テスト用のダミーデータを表示します。");
    return [
      { id: 'mock1', name: 'ゲーム部 (テストデータ)', icon: null, role: 'admin', isAdded: true },
      { id: 'mock2', name: 'プログラミングサークル (テストデータ)', icon: null, role: 'member', isAdded: true },
    ] as Server[];
  }
});

// --- ここからパスワード更新用のThunkを追加 ---
export const updateServerPassword = createAsyncThunk(
  'servers/updatePassword',
  async ({ serverId, password }: { serverId: string; password: string }) => {
    const response = await apiClient.put(`/servers/${serverId}/password`, { password });
    return response.data;
  }
);
// --- ここまで追加 ---

export const serversSlice = createSlice({
  name: 'servers',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchServers.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchServers.fulfilled, (state, action: PayloadAction<Server[]>) => {
        state.status = 'succeeded';
        state.servers = action.payload;
        state.lastFetched = Date.now();
      })
      .addCase(fetchServers.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || null;
      });
  },
});

export const selectAllServers = (state: RootState) => state.servers.servers;
export const getServersStatus = (state: RootState) => state.servers.status;
export const getLastFetched = (state: RootState) => state.servers.lastFetched;
export default serversSlice.reducer;