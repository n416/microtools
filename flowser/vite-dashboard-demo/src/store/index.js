import { configureStore } from '@reduxjs/toolkit';
import workflowReducer from './workflowSlice';

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
  },
});

// ▼▼▼ 修正: Storeが更新されるたびに、その内容をlocalStorageに保存する ▼▼▼
store.subscribe(() => {
  try {
    const state = store.getState();
    // UIの状態（モーダルの開閉など）は保存せず、データのみを保存する
    localStorage.setItem('customerData', JSON.stringify(state.workflow.customerData));
    localStorage.setItem('workflowLibrary', JSON.stringify(state.workflow.workflowLibrary));
    localStorage.setItem('selectedCustomerId', JSON.stringify(state.workflow.selectedCustomerId));
  } catch (e) {
    console.error("Could not save state to localStorage", e);
  }
});