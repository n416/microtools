import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store.ts';

export interface LogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: '作成' | '更新' | '削除';
  reminderMessage: string;
  before?: object;
  after?: object;
}

interface AuditLogState {
  entries: LogEntry[];
}

const initialState: AuditLogState = {
  entries: [],
};

export const auditLogSlice = createSlice({
  name: 'auditLog',
  initialState,
  reducers: {
    addLogEntry: (state, action: PayloadAction<Omit<LogEntry, 'id' | 'timestamp'>>) => {
      const newEntry: LogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        ...action.payload,
      };
      state.entries.unshift(newEntry);
      if (state.entries.length > 30) {
        state.entries.pop();
      }
    },
  },
});

export const { addLogEntry } = auditLogSlice.actions;
export const selectAllLogs = (state: RootState) => state.auditLog.entries;
export default auditLogSlice.reducer;