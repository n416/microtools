import { createListenerMiddleware } from '@reduxjs/toolkit';
import type { RootState } from './store';
import { 
  addNewReminder, 
  updateExistingReminder, 
  deleteExistingReminder, 
  toggleStatusAsync 
} from '@/features/reminders/remindersSlice';
import { addLogEntry } from '@/features/auditLog/auditLogSlice';

export const listenerMiddleware = createListenerMiddleware();

const currentUser = "sample_user"; 

// addReminder -> addNewReminder
listenerMiddleware.startListening({
  actionCreator: addNewReminder.fulfilled, // .fulfilledをリッスン
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

// updateReminder -> updateExistingReminder
listenerMiddleware.startListening({
  actionCreator: updateExistingReminder.fulfilled, // .fulfilledをリッスン
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

// deleteReminder -> deleteExistingReminder
listenerMiddleware.startListening({
  actionCreator: deleteExistingReminder.fulfilled, // .fulfilledをリッスン
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

// toggleReminderStatus -> toggleStatusAsync
listenerMiddleware.startListening({
  actionCreator: toggleStatusAsync.fulfilled, // .fulfilledをリッスン
  effect: (action, listenerApi) => {
    const toggledReminder = action.payload;
    const previousState = listenerApi.getOriginalState() as RootState;
    const originalReminder = previousState.reminders.reminders.find(r => r.id === toggledReminder.id);

    if (originalReminder) {
      const actionLabel = toggledReminder.status === 'paused' ? '休止' : '再開';

      listenerApi.dispatch(addLogEntry({
        user: currentUser,
        action: actionLabel,
        reminderMessage: originalReminder.message,
        before: { id: originalReminder.id, status: originalReminder.status },
        after: { id: toggledReminder.id, status: toggledReminder.status },
      }));
    }
  },
});