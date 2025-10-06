import { createSlice, PayloadAction, nanoid } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';

// RecurrenceRuleの型定義 (変更なし)
type RecurrenceRule =
  | { type: 'none' }
  | { type: 'weekly'; days: string[] }
  | { type: 'interval'; hours: number };

// Reminderの型定義に status を追加
export interface Reminder {
  id: string;
  message: string;
  channel: string;
  startTime: string;
  recurrence: RecurrenceRule;
  status: 'active' | 'paused'; // この行を追加
}

interface RemindersState {
  reminders: Reminder[];
}

// 初期データにも status を追加
const initialState: RemindersState = {
  reminders: [
    {
      id: nanoid(),
      message: '毎週月曜の定例ミーティング',
      channel: '#general',
      startTime: '2025-10-13T09:00:00.000Z',
      recurrence: { type: 'weekly', days: ['monday'] },
      status: 'active',
    },
    {
      id: nanoid(),
      message: '3時間ごとに進捗確認',
      channel: '#development',
      startTime: '2025-10-10T10:00:00.000Z',
      recurrence: { type: 'interval', hours: 3 },
      status: 'paused', // 片方は休止にしておく
    },
  ],
};

export const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {
    // addReminderは、statusを任意で受け取れるように変更
    addReminder: (state, action: PayloadAction<Omit<Reminder, 'id'>>) => {
      const newReminder: Reminder = {
        id: nanoid(),
        ...action.payload,
        // statusが指定されていなければ 'active' をデフォルトにする
        status: action.payload.status || 'active',
      };
      state.reminders.push(newReminder);
    },
    updateReminder: (state, action: PayloadAction<Reminder>) => {
      const { id, message, channel, startTime, recurrence, status } = action.payload;
      const existingReminder = state.reminders.find((reminder) => reminder.id === id);
      if (existingReminder) {
        existingReminder.message = message;
        existingReminder.channel = channel;
        existingReminder.startTime = startTime;
        existingReminder.recurrence = recurrence;
        existingReminder.status = status;
      }
    },
    deleteReminder: (state, action: PayloadAction<string>) => {
      state.reminders = state.reminders.filter(
        (reminder) => reminder.id !== action.payload
      );
    },
    // ↓ここからステータス切り替え用のReducerを追加
    toggleReminderStatus: (state, action: PayloadAction<string>) => {
      const existingReminder = state.reminders.find(
        (reminder) => reminder.id === action.payload
      );
      if (existingReminder) {
        existingReminder.status = existingReminder.status === 'active' ? 'paused' : 'active';
      }
    },
    // ↑ここまで追加
  },
});

export const { addReminder, updateReminder, deleteReminder, toggleReminderStatus } = remindersSlice.actions;

export const selectAllReminders = (state: RootState) => state.reminders.reminders;

export default remindersSlice.reducer;