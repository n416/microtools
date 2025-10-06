import { configureStore } from '@reduxjs/toolkit';
import remindersReducer from '@/features/reminders/remindersSlice';
import auditLogReducer from '@/features/auditLog/auditLogSlice';
import { listenerMiddleware } from './listenerMiddleware';

export const store = configureStore({
  reducer: {
    reminders: remindersReducer,
    auditLog: auditLogReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;