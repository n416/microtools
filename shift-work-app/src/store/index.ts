import { configureStore } from '@reduxjs/toolkit';
import staffReducer from './staffSlice';
import patternReducer from './patternSlice';
import assignmentReducer from './assignmentSlice';
import requirementReducer from './requirementSlice';

export const store = configureStore({
  reducer: {
    staff: staffReducer,
    pattern: patternReducer,
    assignment: assignmentReducer,
    requirement: requirementReducer,
  },
});

// ★★★ この2行が重要です ★★★
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;