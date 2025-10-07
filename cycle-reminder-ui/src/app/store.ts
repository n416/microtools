import { configureStore } from '@reduxjs/toolkit';
import remindersReducer from '@/features/reminders/remindersSlice';
import auditLogReducer from '@/features/auditLog/auditLogSlice';
import serversReducer from '@/features/servers/serversSlice';
import authReducer from '@/features/auth/authSlice';
import channelsReducer from '@/features/channels/channelsSlice';
import toastReducer from '@/features/toast/toastSlice'; // 1. toastReducerをインポート

export const store = configureStore({
  reducer: {
    reminders: remindersReducer,
    auditLog: auditLogReducer,
    servers: serversReducer,
    auth: authReducer,
    channels: channelsReducer,
    toast: toastReducer, // 2. ストアに登録
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;