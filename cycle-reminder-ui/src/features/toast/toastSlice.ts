import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ToastState {
  open: boolean;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  duration: number | null;
}

const initialState: ToastState = {
  open: false,
  message: '',
  severity: 'info',
  duration: 4000,
};

export const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    showToast: (state, action: PayloadAction<Partial<Omit<ToastState, 'open'>>>) => {
      state.open = true;
      state.message = action.payload.message || initialState.message;
      state.severity = action.payload.severity || initialState.severity;
      state.duration = action.payload.duration === null ? null : action.payload.duration || initialState.duration;
    },
    hideToast: (state) => {
      state.open = false;
    },
  },
});

export const { showToast, hideToast } = toastSlice.actions;

export default toastSlice.reducer;