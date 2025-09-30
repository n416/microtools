import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Modal, List, ListItemButton, ListItemText, Typography, Button, Paper, Stack } from '@mui/material';
import Header from '../components/Header';
import CustomerList from '../components/CustomerList';
import CustomerDetail from '../components/CustomerDetail';
import WorkflowList from '../components/WorkflowList';
import TaskDetailPane from '../components/TaskDetailPane';
import BackspaceOutlinedIcon from '@mui/icons-material/BackspaceOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import { useAppContext } from '../context/AppContext';

const modalStyle = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: 600, bgcolor: 'background.paper', border: '2px solid #000', boxShadow: 24, p: 4,
};

const keypadModalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
};
const PASSCODE = '1234';

function MainPage() {
  const {
    customerData,
    selectedCustomerId, setSelectedCustomerId,
    selectedWorkflowId, setSelectedWorkflowId,
    selectedTaskIdentifier, setSelectedTaskIdentifier, // AppContextから取得
    workflowLibrary, assignWorkflowToCustomer, unassignWorkflowFromCustomer,
    handleUpdateTaskMemo, handleToggleTask, handleToggleDocument, proceedWithBranchChange
  } = useAppContext();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerListLocked, setIsCustomerListLocked] = useState(() => JSON.parse(localStorage.getItem('isCustomerListLocked')) || false);
  const [isLockConfirmOpen, setIsLockConfirmOpen] = useState(false);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [isBranchConfirmModalOpen, setIsBranchConfirmModalOpen] = useState(false);
  const [branchChangeContext, setBranchChangeContext] = useState(null);
  
  useEffect(() => { localStorage.setItem('isCustomerListLocked', JSON.stringify(isCustomerListLocked)); }, [isCustomerListLocked]);
  
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

  const selectedCustomer = customerData.find(c => c.id === selectedCustomerId);
  const assignedFlows = selectedCustomer?.assignedWorkflows || [];
  
  const validSelectedWorkflowId = useMemo(() => {
    if (!assignedFlows || assignedFlows.length === 0) return null;
    const isIdValid = assignedFlows.some(wf => wf.instanceId === selectedWorkflowId);
    if (isIdValid) {
      return selectedWorkflowId;
    }
    return assignedFlows.length > 0 ? assignedFlows[0].instanceId : null;
  }, [assignedFlows, selectedWorkflowId]);

  useEffect(() => {
    if (validSelectedWorkflowId !== selectedWorkflowId) {
      setSelectedWorkflowId(validSelectedWorkflowId);
    }
  }, [validSelectedWorkflowId, selectedWorkflowId, setSelectedWorkflowId]);

  const currentWorkflow = assignedFlows.find(wf => wf.instanceId === validSelectedWorkflowId);

  useEffect(() => {
    if (currentWorkflow && currentWorkflow.tasks.length > 0) {
      const findTaskRecursive = (tasks, taskId) => {
        for (const task of tasks) {
          if (task.id === taskId) return true;
          if (task.type === 'nested_branch' && task.selectedOption && task.options[task.selectedOption]) {
            if (findTaskRecursive(task.options[task.selectedOption].tasks, taskId)) return true;
          }
        }
        return false;
      };
      const currentTaskExists = selectedTaskIdentifier && findTaskRecursive(currentWorkflow.tasks, selectedTaskIdentifier.taskId);
      if (!currentTaskExists) {
        const firstTask = currentWorkflow.tasks[0];
        if (firstTask) {
           setSelectedTaskIdentifier({ taskId: firstTask.id });
        }
      }
    } else {
      setSelectedTaskIdentifier(null);
    }
  }, [currentWorkflow, selectedTaskIdentifier, setSelectedTaskIdentifier]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskIdentifier || !currentWorkflow) return null;
     const findTask = (tasks, taskId) => {
      for (const task of tasks) {
        if (task.id === taskId) return task;
        if (task.type === 'nested_branch' && task.selectedOption && task.options[task.selectedOption]) {
          const foundInSub = findTask(task.options[task.selectedOption].tasks || [], taskId);
          if (foundInSub) return foundInSub;
        }
      }
      return null;
    };
    return findTask(currentWorkflow.tasks, selectedTaskIdentifier.taskId);
  }, [selectedTaskIdentifier, currentWorkflow]);

  const handleAssignFlow = (workflowTemplateId) => {
    assignWorkflowToCustomer(selectedCustomerId, workflowTemplateId);
    setIsModalOpen(false);
  };
  
  const handleSelectBranch = (taskId, newOptionKey) => {
    const behavior = localStorage.getItem('branchResetBehavior') || 'confirm';
    if (!currentWorkflow) return;

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
    targetTask = findTaskRecursive(currentWorkflow.tasks, taskId);
    if (!targetTask) return;

    const isSwitching = targetTask.selectedOption && targetTask.selectedOption !== newOptionKey;
    if (!isSwitching) {
      proceedWithBranchChange(selectedCustomerId, validSelectedWorkflowId, taskId, newOptionKey, false);
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

    if (!hasProgress) {
      proceedWithBranchChange(selectedCustomerId, validSelectedWorkflowId, taskId, newOptionKey, false);
      return;
    }

    if (behavior === 'confirm') {
      setBranchChangeContext({ taskId, newOptionKey });
      setIsBranchConfirmModalOpen(true);
      return;
    }
    
    proceedWithBranchChange(selectedCustomerId, validSelectedWorkflowId, taskId, newOptionKey, behavior === 'clear');
  };

  const handleConfirmBranchChange = (shouldReset) => {
    if (branchChangeContext) {
      const { taskId, newOptionKey } = branchChangeContext;
      proceedWithBranchChange(selectedCustomerId, validSelectedWorkflowId, taskId, newOptionKey, shouldReset);
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
                <CustomerList customers={customerData} selectedCustomerId={selectedCustomerId} onSelectCustomer={setSelectedCustomerId} />
            </Box>
        )}
        <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 'fit-content', minWidth: 400 }}>
          <CustomerDetail 
            customer={selectedCustomer} 
            assignedFlows={assignedFlows} 
            onUnassignFlow={(instanceId) => unassignWorkflowFromCustomer(selectedCustomerId, instanceId)} 
            onOpenModal={() => setIsModalOpen(true)} 
          />
          <WorkflowList 
            assignedFlows={assignedFlows} 
            selectedWorkflowId={validSelectedWorkflowId} 
            onSelectWorkflow={setSelectedWorkflowId} 
            currentWorkflow={currentWorkflow} 
            onSelectTask={(taskId) => setSelectedTaskIdentifier({ taskId })}
            selectedTaskId={selectedTaskIdentifier?.taskId} 
          />
        </Box>
        <Box sx={{ flex: '0 1 35%', minWidth: 320 }}>
          <TaskDetailPane
            key={selectedTask ? `${validSelectedWorkflowId}-${selectedTaskIdentifier.taskId}` : 'no-task-selected'}
            task={selectedTask}
            customerId={selectedCustomerId}
            workflowInstanceId={validSelectedWorkflowId}
            onToggleDocument={(docName) => selectedTask && handleToggleDocument(selectedCustomerId, validSelectedWorkflowId, selectedTask.id, docName)}
            onToggleTask={() => selectedTask && handleToggleTask(selectedCustomerId, validSelectedWorkflowId, selectedTask.id)}
            onSelectBranch={handleSelectBranch}
            onUpdateTaskMemo={(memo) => selectedTask && handleUpdateTaskMemo(selectedCustomerId, validSelectedWorkflowId, selectedTask.id, memo)}
          />
        </Box>
      </Box>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2" gutterBottom>業務フローを選択</Typography>
          <List>
            {workflowLibrary.map(wf => (
              <ListItemButton key={wf.id} onClick={() => handleAssignFlow(wf.id)}>
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
             <Button variant="outlined" color="secondary" onClick={() => { setIsBranchConfirmModalOpen(false); setBranchChangeContext(null); }}>
               キャンセル
             </Button>
             <Button variant="outlined" color="primary" onClick={() => handleConfirmBranchChange(false)}>
               はい (進捗を維持)
             </Button>
             <Button variant="contained" color="primary" onClick={() => handleConfirmBranchChange(true)}>
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