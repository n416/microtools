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
// ▼▼▼ 新しいページをインポート ▼▼▼
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage'));


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
            {/* ▼▼▼ 新しいルートを追加 ▼▼▼ */}
            <Route path="/system-settings" element={<SystemSettingsPage />} />
          </Routes>
        </Suspense>
      </Box>

       {/* ... (モーダル部分は変更なし) ... */}
    </ThemeProvider>
  );
}

export default App;