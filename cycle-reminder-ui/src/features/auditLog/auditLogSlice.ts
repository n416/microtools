import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';
import apiClient from '@/api/client';

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: '作成' | '更新' | '削除' | '休止' | '再開' | '復元';
  reminderMessage: string;
  before?: object;
  after?: object;
  serverId?: string; // serverIdを追加
}

interface AuditLogState {
  entries: LogEntry[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: AuditLogState = {
  entries: [],
  status: 'idle',
  error: null,
};

// --- ここから fetchLogs を修正 ---
export const fetchLogs = createAsyncThunk('auditLog/fetchLogs', async (serverId: string) => {
  const response = await apiClient.get(`/logs/${serverId}`);
  return response.data as LogEntry[];
});
// --- ここまで修正 ---

export const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchLogs.pending, (state) => {
        state.status = 'idle'; // 状態をidleに戻す
        state.entries = []; // ログをクリア
      })
      .addCase(fetchLogs.fulfilled, (state, action: PayloadAction<LogEntry[]>) => {
        state.status = 'succeeded';
        state.entries = action.payload;
      })
      .addCase(fetchLogs.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || null;
      });
  },
});

export const selectAllLogs = (state: RootState) => state.auditLog.entries;
export const getLogsStatus = (state: RootState) => state.auditLog.status;

export default auditLogSlice.reducer;