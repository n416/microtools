import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';
import apiClient from '@/api/client';

type RecurrenceRule =
  | { type: 'none' }
  | { type: 'weekly'; days: string[] }
  | { type: 'interval'; hours: number };

export interface Reminder {
  id: string;
  serverId: string; // serverIdを追加
  message: string;
  channel: string;
  startTime: string;
  recurrence: RecurrenceRule;
  status: 'active' | 'paused';
}
interface RemindersState {
  reminders: Reminder[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}
const initialState: RemindersState = {
  reminders: [],
  status: 'idle',
  error: null,
};

// --- API呼び出しを全面的に修正 ---

export const fetchReminders = createAsyncThunk('reminders/fetchReminders', async (serverId: string) => {
  const response = await apiClient.get(`/reminders/${serverId}`);
  return response.data as Reminder[];
});

export const addNewReminder = createAsyncThunk('reminders/addNewReminder', 
  async ({ serverId, newReminder }: { serverId: string; newReminder: Omit<Reminder, 'id' | 'status' | 'serverId'> & { status?: 'active' | 'paused' } }, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const writeToken = state.auth.writeTokens[serverId];
    const response = await apiClient.post(`/reminders/${serverId}`, newReminder, {
      headers: { 'x-write-token': writeToken }
    });
    return response.data as Reminder;
});

export const updateExistingReminder = createAsyncThunk('reminders/updateExistingReminder', async (reminder: Reminder, thunkAPI) => {
  const state = thunkAPI.getState() as RootState;
  const writeToken = state.auth.writeTokens[reminder.serverId];
  
  
  // --- ★★★ 調査用ログを修正・追加 ★★★ ---
  console.log('%c[remindersSlice] updateExistingReminder 調査ログ', 'color: blue; font-weight: bold;');
  console.log('[remindersSlice] 渡されたリマインダー情報:', reminder);
  console.log('[remindersSlice] 使用しようとしているサーバーID:', reminder.serverId);
  console.log('[remindersSlice] 現在保存されている全書き込みトークン:', state.auth.writeTokens);
  console.log(`[remindersSlice] ID '${reminder.serverId}' でトークンを検索した結果:`, writeToken ? '見つかりました' : '★★★見つかりませんでした★★★');
  // --- ★★★ ここまで修正・追加 ★★★ ---


  const response = await apiClient.put(`/reminders/${reminder.id}`, reminder, {
    headers: { 'x-write-token': writeToken }
  });
  return response.data as Reminder;
});
// --- ここまで修正 ---

export const deleteExistingReminder = createAsyncThunk('reminders/deleteExistingReminder', 
  async ({ id, serverId }: { id: string, serverId: string }, thunkAPI) => {
    const state = thunkAPI.getState() as RootState;
    const writeToken = state.auth.writeTokens[serverId];
    await apiClient.delete(`/reminders/${id}`, {
      headers: { 'x-write-token': writeToken }
    });
    return id;
});

export const toggleStatusAsync = createAsyncThunk('reminders/toggleStatusAsync', async (reminder: Reminder, thunkAPI) => {
  const state = thunkAPI.getState() as RootState;
  const writeToken = state.auth.writeTokens[reminder.serverId];
  const newStatus = reminder.status === 'active' ? 'paused' : 'active';
  const response = await apiClient.put(`/reminders/${reminder.id}`, { ...reminder, status: newStatus }, {
    headers: { 'x-write-token': writeToken }
  });
  return response.data as Reminder;
});

// --- ここまで修正 ---

export const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReminders.pending, (state) => {
        state.status = 'loading';
        state.reminders = []; // 読み込み開始時に一度空にする
      })
      .addCase(fetchReminders.fulfilled, (state, action: PayloadAction<Reminder[]>) => {
        state.status = 'succeeded';
        state.reminders = action.payload;
      })
      .addCase(fetchReminders.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || null;
      })
      .addCase(addNewReminder.fulfilled, (state, action: PayloadAction<Reminder>) => {
        state.reminders.push(action.payload);
      })
      .addCase(deleteExistingReminder.fulfilled, (state, action: PayloadAction<string>) => {
        state.reminders = state.reminders.filter(r => r.id !== action.payload);
      })
      .addMatcher(
        (action): action is PayloadAction<Reminder> => action.type === updateExistingReminder.fulfilled.type || action.type === toggleStatusAsync.fulfilled.type,
        (state, action) => {
          const index = state.reminders.findIndex(r => r.id === action.payload.id);
          if (index !== -1) {
            state.reminders[index] = action.payload;
          }
        }
      );
  },
});

export const selectAllReminders = (state: RootState) => state.reminders.reminders;
export const getRemindersStatus = (state: RootState) => state.reminders.status;
export default remindersSlice.reducer;