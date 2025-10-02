import { configureStore } from '@reduxjs/toolkit';
import workflowReducer from './workflowSlice';
import knowledgeReducer from './knowledgeSlice'; // インポート

export const store = configureStore({
  reducer: {
    workflow: workflowReducer,
    knowledge: knowledgeReducer, // 追加
  },
});

store.subscribe(() => {
  try {
    const state = store.getState();
    // UIの状態（モーダルの開閉など）は保存せず、データと選択状態のみを保存
    localStorage.setItem('customerData', JSON.stringify(state.workflow.customerData));
    localStorage.setItem('workflowLibrary', JSON.stringify(state.workflow.workflowLibrary));
    localStorage.setItem('selectedCustomerId', JSON.stringify(state.workflow.selectedCustomerId));
    localStorage.setItem('selectedWorkflowId', JSON.stringify(state.workflow.selectedWorkflowId));
    localStorage.setItem('selectedTaskId', JSON.stringify(state.workflow.selectedTaskId));
    // 新しい知識ライブラリも保存
    localStorage.setItem('knowledgeLibrary', JSON.stringify(state.knowledge.library));
  } catch (e) {
    console.error("Could not save state to localStorage", e);
  }
});