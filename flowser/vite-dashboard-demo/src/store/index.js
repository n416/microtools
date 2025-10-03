import { configureStore } from '@reduxjs/toolkit';
import caseReducer from './caseSlice';
import knowledgeReducer from './knowledgeSlice';
import flowCategoryReducer from './flowCategorySlice';

export const store = configureStore({
  reducer: {
    case: caseReducer,
    knowledge: knowledgeReducer,
    flowCategory: flowCategoryReducer,
  },
});

store.subscribe(() => {
  try {
    const state = store.getState();
    localStorage.setItem('customerData', JSON.stringify(state.case.customerData));
    localStorage.setItem('flowLibrary', JSON.stringify(state.case.flowLibrary));
    localStorage.setItem('selectedCustomerId', JSON.stringify(state.case.selectedCustomerId));
    localStorage.setItem('selectedCaseId', JSON.stringify(state.case.selectedCaseId));
    localStorage.setItem('selectedTaskId', JSON.stringify(state.case.selectedTaskId));
    localStorage.setItem('knowledgeLibrary', JSON.stringify(state.knowledge.library));
    localStorage.setItem('flowCategories', JSON.stringify(state.flowCategory.categories));
    localStorage.setItem('selectedFlowCategoryId', JSON.stringify(state.flowCategory.selectedCategoryId));
  } catch (e) {
    console.error("Could not save state to localStorage", e);
  }
});