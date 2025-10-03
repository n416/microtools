import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Modal, List, ListItemButton, ListItemText, Typography, Button, Paper, Stack } from '@mui/material';
import Header from '../components/Header';
import CustomerList from '../components/CustomerList';
import CustomerDetail from '../components/CustomerDetail';
import CaseList from '../components/CaseList';
import TaskDetailPane from '../components/TaskDetailPane';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import ClearIcon from '@mui/icons-material/Clear';

import { useSelector, useDispatch } from 'react-redux';
import {
  setSelectedCustomerId,
  setSelectedCaseId,
  setSelectedTaskId,
  assignFlowToCustomer,
  unassignCaseFromCustomer,
  updateTaskMemo,
  toggleTask,
  selectBranch,
  toggleDocument,
} from '../store/caseSlice';

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 600, bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4,
};
const keypadModalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
};
const PASSCODE = '1234';

function MainPage() {
  const dispatch = useDispatch();

  const {
    customerData,
    flowLibrary,
    selectedCustomerId,
    selectedCaseId,
    selectedTaskId,
  } = useSelector((state) => state.case);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerListLocked, setIsCustomerListLocked] = useState(() => JSON.parse(localStorage.getItem('isCustomerListLocked')) || false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [isBranchConfirmModalOpen, setIsBranchConfirmModalOpen] = useState(false);
  const [branchChangeContext, setBranchChangeContext] = useState(null);

  useEffect(() => {
    localStorage.setItem('isCustomerListLocked', JSON.stringify(isCustomerListLocked));
  }, [isCustomerListLocked]);

  const handleVisibilityChange = useCallback(() => {
    const securityModeEnabled = JSON.parse(localStorage.getItem('securityMode')) || false;
    if (securityModeEnabled && document.visibilityState === 'hidden' && !isCustomerListLocked) {
      setIsCustomerListLocked(true);
    }
  }, [isCustomerListLocked]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [handleVisibilityChange]);

  const selectedCustomer = useMemo(() => customerData.find(c => c.id === selectedCustomerId), [customerData, selectedCustomerId]);
  const assignedCases = useMemo(() => selectedCustomer?.assignedCases || [], [selectedCustomer]);

  const validSelectedCaseId = useMemo(() => {
    if (!assignedCases || assignedCases.length === 0) return null;
    const isIdValid = assignedCases.some(wf => wf.instanceId === selectedCaseId);
    if (isIdValid) return selectedCaseId;
    return assignedCases[0]?.instanceId || null;
  }, [assignedCases, selectedCaseId]);

  useEffect(() => {
    if (validSelectedCaseId !== selectedCaseId) {
      dispatch(setSelectedCaseId(validSelectedCaseId));
    }
  }, [validSelectedCaseId, selectedCaseId, dispatch]);

  const currentCase = useMemo(() => assignedCases.find(wf => wf.instanceId === validSelectedCaseId), [assignedCases, validSelectedCaseId]);

  useEffect(() => {
    if (currentCase && currentCase.tasks.length > 0) {
      const findTaskRecursive = (tasks, id) => {
        for (const task of tasks) {
          if (task.id === id) return true;
          if (task.type === 'nested_branch' && task.selectedOption && task.options[task.selectedOption]) {
            if (findTaskRecursive(task.options[task.selectedOption].tasks, id)) return true;
          }
        }
        return false;
      };

      const currentTaskExists = selectedTaskId && findTaskRecursive(currentCase.tasks, selectedTaskId);

      if (!currentTaskExists) {
        const firstTask = currentCase.tasks[0];
        if (firstTask) {
          dispatch(setSelectedTaskId(firstTask.id));
        }
      }
    } else {
      if (selectedTaskId !== null) {
        dispatch(setSelectedTaskId(null));
      }
    }
  }, [currentCase, selectedTaskId, dispatch]);


  const selectedTask = useMemo(() => {
    if (!selectedTaskId || !currentCase) return null;
    const findTask = (tasks, id) => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.type === 'nested_branch' && task.selectedOption && task.options[task.selectedOption]) {
          const foundInSub = findTask(task.options[task.selectedOption].tasks || [], id);
          if (foundInSub) return foundInSub;
        }
      }
      return null;
    };
    return findTask(currentCase.tasks, selectedTaskId);
  }, [selectedTaskId, currentCase]);

  const handleAssignFlow = (flowTemplateId) => {
    dispatch(assignFlowToCustomer({ customerId: selectedCustomerId, flowTemplateId }));
    setIsModalOpen(false);
  };
  const handleUnassignCase = (caseInstanceId) => {
    dispatch(unassignCaseFromCustomer({ customerId: selectedCustomerId, caseInstanceId }));
  };
  const handleUpdateTaskMemo = (taskId, memo) => {
    dispatch(updateTaskMemo({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId, memo }));
  };
  const handleToggleTask = (taskId) => {
    dispatch(toggleTask({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId }));
  };
  const handleToggleDocument = (taskId, docName) => {
    dispatch(toggleDocument({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId, docName }));
  };
  const handleSelectBranch = (taskId, newOptionKey) => {
    const behavior = localStorage.getItem('branchResetBehavior') || 'confirm';
    if (!currentCase) return;

    let targetTask = null;
    const findTaskRecursive = (tasks, id) => {
      for (const task of tasks) {
        if (task.id === id) return task;
        if (task.type === 'nested_branch' && task.options) {
          for (const key in task.options) {
            const found = findTaskRecursive(task.options[key].tasks || [], id);
            if (found) return found;
          }
        }
      }
      return null;
    };
    targetTask = findTaskRecursive(currentCase.tasks, taskId);
    if (!targetTask) return;

    const isSwitching = targetTask.selectedOption && targetTask.selectedOption !== newOptionKey;
    if (!isSwitching) {
      dispatch(selectBranch({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId, optionKey: newOptionKey, shouldReset: false }));
      return;
    }

    const prevOptionKey = targetTask.selectedOption;
    const prevSubTasks = prevOptionKey ? targetTask.options[prevOptionKey]?.tasks || [] : [];

    const hasCompletedSubTasksRecursive = (tasks) => {
      for (const task of tasks) {
        if (task.completed) return true;
        if (task.type === 'nested_branch' && task.selectedOption) {
          if (hasCompletedSubTasksRecursive(task.options[task.selectedOption].tasks || [])) {
            return true;
          }
        }
      }
      return false;
    };

    const hasProgress = hasCompletedSubTasksRecursive(prevSubTasks);

    if (!hasProgress || behavior === 'keep') {
      dispatch(selectBranch({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId, optionKey: newOptionKey, shouldReset: false }));
      return;
    }
    if (behavior === 'clear') {
      dispatch(selectBranch({ customerId: selectedCustomerId, caseInstanceId: validSelectedCaseId, taskId, optionKey: newOptionKey, shouldReset: true }));
      return;
    }

    setBranchChangeContext({ taskId, newOptionKey });
    setIsBranchConfirmModalOpen(true);
  };

  const handleConfirmBranchChange = (shouldReset) => {
    if (branchChangeContext) {
      const { taskId, newOptionKey } = branchChangeContext;
      dispatch(selectBranch({
        customerId: selectedCustomerId,
        caseInstanceId: validSelectedCaseId,
        taskId,
        optionKey: newOptionKey,
        shouldReset
      }));
    }
    setIsBranchConfirmModalOpen(false);
    setBranchChangeContext(null);
  };

  const handleToggleLock = () => {
    if (isCustomerListLocked) {
      setPasscodeInput('');
      setIsKeypadOpen(true);
    } else {
      setIsLockConfirmOpen(true);
    }
  };
  const handleConfirmLock = () => {
    setIsCustomerListLocked(true);
    setIsLockConfirmOpen(false);
  };
  const handleKeypadInput = (num) => setPasscodeInput(prev => prev + num);
  const handleKeypadBackspace = () => setPasscodeInput(prev => prev.slice(0, -1));
  const handleKeypadClear = () => setPasscodeInput('');
  useEffect(() => {
    if (passcodeInput === PASSCODE) {
      setIsCustomerListLocked(false);
      setIsKeypadOpen(false);
      setPasscodeInput('');
    }
  }, [passcodeInput]);
  const keypadItems = [
    { type: 'num', value: 1 }, { type: 'num', value: 2 }, { type: 'num', value: 3 },
    { type: 'num', value: 4 }, { type: 'num', value: 5 }, { type: 'num', value: 6 },
    { type: 'num', value: 7 }, { type: 'num', value: 8 }, { type: 'num', value: 9 },
    { type: 'clear', value: <ClearIcon /> }, { type: 'num', value: 0 }, { type: 'bs', value: <BackspaceOutlinedIcon /> },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ p: '0 24px' }}><Header isLocked={isCustomerListLocked} onToggleLock={handleToggleLock} /></Box>
      <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
        {!isCustomerListLocked && (
          <Box sx={{ flex: '0 1 320px', minWidth: 280, transition: 'all 0.3s ease' }}>
            <CustomerList customers={customerData} selectedCustomerId={selectedCustomerId} onSelectCustomer={(id) => dispatch(setSelectedCustomerId(id))} />
          </Box>
        )}
        <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 'fit-content', minWidth: 400 }}>
          <CustomerDetail
            customer={selectedCustomer}
            assignedCases={assignedCases}
            onUnassignCase={handleUnassignCase}
            onOpenModal={() => setIsModalOpen(true)}
          />
          <CaseList
            assignedCases={assignedCases}
            selectedCaseId={validSelectedCaseId}
            onSelectCase={(id) => dispatch(setSelectedCaseId(id))}
            currentCase={currentCase}
            onSelectTask={(id) => dispatch(setSelectedTaskId(id))}
            selectedTaskId={selectedTaskId}
          />
        </Box>
        <Box sx={{ flex: '0 1 35%', minWidth: 320 }}>
          <TaskDetailPane
            key={selectedTask ? `${validSelectedCaseId}-${selectedTaskId}` : 'no-task-selected'}
            task={selectedTask}
            onUpdateTaskMemo={(memo) => selectedTask && handleUpdateTaskMemo(selectedTask.id, memo)}
            onToggleTask={() => selectedTask && handleToggleTask(selectedTask.id)}
            onSelectBranch={(optionKey) => selectedTask && handleSelectBranch(selectedTask.id, optionKey)}
            onToggleDocument={(docName) => selectedTask && handleToggleDocument(selectedTask.id, docName)}
          />
        </Box>
      </Box>
      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2" gutterBottom>フローを選択</Typography>
          <List>
            {flowLibrary.map(wf => (
              <ListItemButton key={wf.id} onClick={() => handleAssignFlow(wf.id)} disabled={assignedCases.some(af => af.templateId === wf.id)}>
                <ListItemText primary={wf.name} secondary={wf.description} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Modal>

      <Modal open={isLockConfirmOpen} onClose={() => setIsLockConfirmOpen(false)}>
        <Box sx={modalStyle} style={{ width: 400 }}>
          <Typography variant="h6" component="h2">顧客リストをロックしますか？</Typography>
          <Typography sx={{ mt: 2 }}>ロックすると、パスコードを入力するまでリストは表示されません。</Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={() => setIsLockConfirmOpen(false)}>キャンセル</Button>
            <Button variant="contained" color="primary" onClick={handleConfirmLock}>リストをロック</Button>
          </Box>
        </Box>
      </Modal>

      <Modal open={isBranchConfirmModalOpen} onClose={() => { setIsBranchConfirmModalOpen(false); setBranchChangeContext(null); }}>
        <Box sx={{ ...modalStyle, width: 500 }}>
          <Typography variant="h6" component="h2">プラン変更時の進捗の扱いを選択</Typography>
          <Typography sx={{ mt: 2 }}>
            以前のプランには完了済みのサブタスクが存在します。新しいプランに切り替える際に、以前のプランの進捗をどう扱いますか？
          </Typography>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button variant="outlined" onClick={() => { setIsBranchConfirmModalOpen(false); setBranchChangeContext(null); }}>
              キャンセル
            </Button>
            <Button variant="outlined" color="primary" onClick={() => handleConfirmBranchChange(false)}>
              はい (進捗を維持)
            </Button>
            <Button variant="contained" color="error" onClick={() => handleConfirmBranchChange(true)}>
              はい (進捗をクリア)
            </Button>
          </Box>
        </Box>
      </Modal>

      <Modal open={isKeypadOpen} onClose={() => setIsKeypadOpen(false)}>
        <Box sx={keypadModalStyle}>
          <Paper sx={{ p: 2, borderRadius: 2, boxShadow: 24, border: '2px solid #000' }}>
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 1, textAlign: 'center', letterSpacing: '0.5em', fontSize: '1.4rem', minHeight: '2.4rem', overflow: 'hidden' }}>
                {passcodeInput.replace(/./g, '*')}
              </Paper>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, width: 240 }}>
                {keypadItems.map((item, index) => {
                  let clickHandler = () => { };
                  if (item.type === 'num') clickHandler = () => handleKeypadInput(item.value.toString());
                  if (item.type === 'clear') clickHandler = handleKeypadClear;
                  if (item.type === 'bs') clickHandler = handleKeypadBackspace;
                  return (
                    <Box key={index} sx={{ flexBasis: 'calc(33.333% - 8px)', flexGrow: 1 }}>
                      <Button fullWidth variant="outlined" onClick={clickHandler} sx={{ height: '55px', fontSize: '1.2rem' }}>
                        {item.value}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            </Stack>
          </Paper>
        </Box>
      </Modal>
    </Box>
  );
}
export default MainPage;