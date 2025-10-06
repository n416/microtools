import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { addReminder, updateReminder, deleteReminder, toggleReminderStatus } from '@/features/reminders/remindersSlice';
import { addLogEntry } from '@/features/auditLog/auditLogSlice';

export const listenerMiddleware = createListenerMiddleware();

const currentUser = "sample_user"; 

listenerMiddleware.startListening({
  actionCreator: addReminder,
  effect: (action, listenerApi) => {
    const newReminder = action.payload;
    const isRestoreAction = newReminder.message.startsWith('[復元]');
    const actionLabel = isRestoreAction ? '復元' : '作成';

    listenerApi.dispatch(addLogEntry({
      user: currentUser,
      action: actionLabel,
      reminderMessage: newReminder.message,
      after: newReminder,
    }));
  },
});

listenerMiddleware.startListening({
  actionCreator: updateReminder,
  effect: (action, listenerApi) => {
    const updatedReminder = action.payload;
    const previousState = listenerApi.getOriginalState() as RootState;
    const originalReminder = previousState.reminders.reminders.find(r => r.id === updatedReminder.id);

    listenerApi.dispatch(addLogEntry({
      user: currentUser,
      action: '更新',
      reminderMessage: updatedReminder.message,
      before: originalReminder,
      after: updatedReminder,
    }));
  },
});

listenerMiddleware.startListening({
  actionCreator: deleteReminder,
  effect: (action, listenerApi) => {
    const deletedId = action.payload;
    const previousState = listenerApi.getOriginalState() as RootState;
    const originalReminder = previousState.reminders.reminders.find(r => r.id === deletedId);

    if (originalReminder) {
      listenerApi.dispatch(addLogEntry({
        user: currentUser,
        action: '削除',
        reminderMessage: originalReminder.message,
        before: originalReminder,
      }));
    }
  },
});

// --- ↓ここから toggleReminderStatus のリスナーを修正 ---
listenerMiddleware.startListening({
  actionCreator: toggleReminderStatus,
  effect: (action, listenerApi) => {
    const toggledId = action.payload;
    const previousState = listenerApi.getOriginalState() as RootState;
    const originalReminder = previousState.reminders.reminders.find(r => r.id === toggledId);

    if (originalReminder) {
      const newStatus = originalReminder.status === 'active' ? 'paused' : 'active';
      const actionLabel = newStatus === 'paused' ? '休止' : '再開';

      listenerApi.dispatch(addLogEntry({
        user: currentUser,
        action: actionLabel,
        reminderMessage: originalReminder.message,
        // beforeとafterに、idも一緒に入れるように変更
        before: { id: originalReminder.id, status: originalReminder.status },
        after: { id: originalReminder.id, status: newStatus },
      }));
    }
  },
});
// --- ↑ここまで修正 ---