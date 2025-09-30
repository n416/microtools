import React from 'react';
import {
  Paper, Typography, Box, List, ListItem,
  ListItemText, ListItemButton, ListItemIcon, Tabs, Tab
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AttachmentIcon from '@mui/icons-material/Attachment';

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

// ▼▼▼ 修正: Propsを全面的に見直し ▼▼▼
function WorkflowList({ assignedFlows, selectedWorkflowId, onSelectWorkflow, currentWorkflow, onSelectTask, selectedTaskId }) {

  const handleTabChange = (event, newValue) => {
    onSelectWorkflow(newValue);
  };

  // ▼▼▼ 修正: 表示ロジックを全面的に見直し ▼▼▼
  if (!assignedFlows || assignedFlows.length === 0) {
    return (
      <Pane>
        <Typography variant="h6" gutterBottom>🤖 業務フロー</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            この顧客には業務フローが割り当てられていません。
          </Typography>
        </Box>
      </Pane>
    );
  }

  return (
    <Pane>
      <Typography variant="h6" gutterBottom>🤖 業務フロー</Typography>

      {/* --- タブ表示エリア --- */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
        <Tabs value={selectedWorkflowId} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          {assignedFlows.map(flow => (
            <Tab label={flow.name} value={flow.id} key={flow.id} />
          ))}
        </Tabs>
      </Box>

      {/* --- タスクリスト表示エリア --- */}
      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        {currentWorkflow ? (
          <List dense>
            {currentWorkflow.tasks.map((task) => {
              const labelId = `checkbox-list-label-${task.id}`;
              return (
                <ListItem key={`${currentWorkflow.id}-${task.id}`} disablePadding>
                  <ListItemButton
                    selected={selectedTaskId === task.id}
                    onClick={() => onSelectTask(task.id)}
                    sx={{ p: '4px 8px' }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                      {task.completed ? <Stamp>済</Stamp> : <Box sx={{ width: 28 }} />}
                    </ListItemIcon>
                    <ListItemText id={labelId} primary={task.text} />
                    {task.documents && task.documents.length > 0 && (
                      <ListItemIcon sx={{ minWidth: 'auto' }}>
                        <AttachmentIcon fontSize="small" color="action" />
                      </ListItemIcon>
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">フローを選択してください。</Typography>
          </Box>
        )}
      </Box>
    </Pane>
  );
  // ▲▲▲ 修正 ▲▲▲
}
export default WorkflowList;