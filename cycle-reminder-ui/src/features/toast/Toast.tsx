import React, { useEffect } from 'react'; // useEffect をインポート
import { Snackbar, Alert } from '@mui/material';
import { useAppSelector, useAppDispatch } from '@/app/hooks';
import { hideToast } from './toastSlice';

export const Toast = () => {
  const dispatch = useAppDispatch();
  const { open, message, severity, duration } = useAppSelector((state) => state.toast);

  // --- ★★★ 調査用ログを追加 ★★★ ---
  useEffect(() => {
    console.log('%c[Toast Component] State Updated:', 'color: orange; font-weight: bold;', { open, message, severity });
  }, [open, message, severity]);
  // --- ★★★ ここまで追加 ★★★ ---


  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    dispatch(hideToast());
  };

  return (
    <Snackbar open={open} autoHideDuration={duration} onClose={handleClose}>
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }} variant="filled">
        {message}
      </Alert>
    </Snackbar>
  );
};