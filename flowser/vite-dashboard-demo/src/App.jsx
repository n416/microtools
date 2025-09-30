import React, { Suspense, lazy, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, Box, CircularProgress, Modal, Typography, TextField, Button, LinearProgress, Grid } from '@mui/material';
import { theme } from './theme';
import { useSelector, useDispatch } from 'react-redux';
import {
  closeAiModal,
  updateAiSuggestion,
  updateTaskMemo,
  setSelectedCustomerId,
  setSelectedWorkflowId,
  setSelectedTaskId
} from './store/workflowSlice';

const MainPage = lazy(() => import('./pages/MainPage'));
const FlowDesignerPage = lazy(() => import('./pages/FlowDesignerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 600,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

function App() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isAiModalOpen, aiSuggestion, refiningTask, originalMemo, isApiCommunicating } = useSelector((state) => state.workflow);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [navigationContext, setNavigationContext] = useState(null);

  const handleAcceptSuggestion = () => {
    if (refiningTask) {
      const { task, customerId, workflowInstanceId } = refiningTask;
      dispatch(updateTaskMemo({ customerId, workflowInstanceId, taskId: task.id, memo: aiSuggestion }));
      setNavigationContext({ customerId, workflowInstanceId, taskId: task.id });
    }
    const wasOnMainPage = location.pathname === '/';
    dispatch(closeAiModal());
    if (!wasOnMainPage) {
      setShowConfirmationModal(true);
    }
  };

  const handleConfirmNavigation = () => {
    if (navigationContext) {
      dispatch(setSelectedCustomerId(navigationContext.customerId));
      dispatch(setSelectedWorkflowId(navigationContext.workflowInstanceId));
      dispatch(setSelectedTaskId(navigationContext.taskId));
    }
    setShowConfirmationModal(false);
    navigate('/');
    setNavigationContext(null);
  };
  
  const handleDeclineNavigation = () => {
    setShowConfirmationModal(false);
    setNavigationContext(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        {isApiCommunicating && <LinearProgress sx={{ position: 'absolute', width: '100%', zIndex: 1300 }} />}
        <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><CircularProgress /></Box>}>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/designer" element={<FlowDesignerPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </Box>

      <Modal open={isAiModalOpen} onClose={() => dispatch(closeAiModal())} disableEscapeKeyDown>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">AIによる整形案</Typography>
          <Typography sx={{ mt: 1, mb: 2 }} color="text.secondary">AIが生成した以下の内容でメモを上書きしますか？（内容は編集できます）</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>変換前のメモ</Typography>
              <TextField fullWidth multiline rows={5} value={originalMemo || ''} InputProps={{ readOnly: true }} variant="outlined" sx={{ bgcolor: 'grey.100' }} />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" gutterBottom>AIの提案</Typography>
              <TextField fullWidth multiline rows={5} value={aiSuggestion} onChange={(e) => dispatch(updateAiSuggestion(e.target.value))} variant="outlined" autoFocus />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={() => dispatch(closeAiModal())}>キャンセル</Button>
            <Button variant="contained" onClick={handleAcceptSuggestion}>この内容で上書き</Button>
          </Box>
        </Box>
      </Modal>

       <Modal open={showConfirmationModal} onClose={handleDeclineNavigation}>
        <Box sx={{ ...modalStyle, width: 400 }}>
          <Typography variant="h6" component="h2">更新完了</Typography>
          <Typography sx={{ mt: 2 }}>タスクのメモを更新しました。顧客管理画面に移動して確認しますか？</Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={handleDeclineNavigation}>いいえ</Button>
            <Button variant="contained" onClick={handleConfirmNavigation}>はい</Button>
          </Box>
        </Box>
      </Modal>
    </ThemeProvider>
  );
}

export default App;