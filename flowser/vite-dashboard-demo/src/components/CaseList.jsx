import React, { Fragment } from 'react';
import {
  Paper, Typography, Box, List, ListItem,
  ListItemText, ListItemButton, ListItemIcon, Tabs, Tab, Chip
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AttachmentIcon from '@mui/icons-material/Attachment';
import SubdirectoryArrowRightIcon from '@mui/icons-material/SubdirectoryArrowRight';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import NoteAltOutlinedIcon from '@mui/icons-material/NoteAltOutlined';

const Pane = styled(Paper)({
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minHeight: 0,
});

const Stamp = styled('div')({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '2px solid #e53935',
  color: '#e53935',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '14px',
  transform: 'rotate(-10deg)',
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
});

const isTaskCompletedRecursive = (task) => {
  if (task.type !== 'nested_branch') {
    return task.completed;
  }

  if (!task.selectedOption) {
    return false;
  }
  const selectedSubTasks = task.options[task.selectedOption].tasks;
  return selectedSubTasks.every(subTask => isTaskCompletedRecursive(subTask));
};

const TaskItem = ({ task, selectedTaskId, onSelectTask, level = 0 }) => {
  const isCompleted = isTaskCompletedRecursive(task);

  return (
    <Fragment>
      <ListItem
        key={task.id}
        disablePadding
        sx={{ pl: level * 2 }}
      >
        <ListItemButton
          selected={selectedTaskId === task.id}
          onClick={() => onSelectTask(task.id)}
          sx={{ p: '4px 8px' }}
        >
          <ListItemIcon sx={{ minWidth: 40, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            {level > 0 && <SubdirectoryArrowRightIcon fontSize="small" color="action" sx={{ mr: 1 }} />}
            {isCompleted ? <Stamp>済</Stamp> : <Box sx={{ width: 28 }} />}
          </ListItemIcon>
          <ListItemText primary={task.text} />
          {task.type === 'nested_branch' && (
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: 'text.secondary' }}>
              <CallSplitIcon fontSize="small" />
            </ListItemIcon>
          )}
          {task.type === 'nested_branch' && task.selectedOption && (
            <Chip label={task.options[task.selectedOption].label} size="small" variant="outlined" sx={{ mr: 1 }} />
          )}
          {task.memo && (
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
              <NoteAltOutlinedIcon fontSize="small" color="action" />
            </ListItemIcon>
          )}
          {task.documents && task.documents.length > 0 && (
            <ListItemIcon sx={{ minWidth: 'auto' }}>
              <AttachmentIcon fontSize="small" color="action" />
            </ListItemIcon>
          )}
        </ListItemButton>
      </ListItem>

      {task.type === 'nested_branch' && task.selectedOption && task.options[task.selectedOption] &&
        task.options[task.selectedOption].tasks.map(subTask => (
          <TaskItem
            key={subTask.id}
            task={subTask}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            level={level + 1}
          />
        ))
      }
    </Fragment>
  );
};


function CaseList({ assignedCases, selectedCaseId, onSelectCase, currentCase, onSelectTask, selectedTaskId }) {

  const handleTabChange = (event, newValue) => {
    onSelectCase(newValue);
  };

  if (!assignedCases || assignedCases.length === 0) {
    return (
      <Pane>
        <Typography variant="h6" gutterBottom>🤖 実行中ケース</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            この顧客には実行中のケースがありません。
          </Typography>
        </Box>
      </Pane>
    );
  }

  return (
    <Pane>
      <Typography variant="h6" gutterBottom>🤖 実行中ケース</Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={selectedCaseId || false} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {assignedCases.map(flow => (
            <Tab label={flow.name} value={flow.instanceId} key={flow.instanceId} />
          ))}
        </Tabs>
      </Box>

      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        {currentCase ? (
          <List dense>
            {currentCase.tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
              />
            ))}
          </List>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">ケースを選択してください。</Typography>
          </Box>
        )}
      </Box>
    </Pane>
  );
}
export default CaseList;