import React from 'react';
import { 
  Paper, Typography, Box, List, ListItem, 
  ListItemText, ListItemButton, ListItemIcon
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

// ▼▼▼ 修正: 「済」スタンプのスタイルを定義 ▼▼▼
const Stamp = styled('div')({
  width: '28px',
  height: '28px',
  borderRadius: '50%',
  border: '2px solid #e53935', // 赤色
  color: '#e53935',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  fontSize: '14px',
  transform: 'rotate(-10deg)', // 少し傾ける
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
});
// ▲▲▲ 修正 ▲▲▲

function WorkflowList({ workflow, onSelectTask, selectedTaskId }) {
  if (!workflow) {
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
      <Typography variant="subtitle1" gutterBottom>{workflow.name}</Typography>
      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <List dense>
          {workflow.tasks.map((task) => {
            const labelId = `checkbox-list-label-${task.id}`;
            return (
              <ListItem
                key={`${workflow.id}-${task.id}`}
                disablePadding
              >
                <ListItemButton 
                  selected={selectedTaskId === task.id}
                  onClick={() => onSelectTask(task.id)}
                  sx={{ p: '4px 8px' }}
                >
                  {/* ▼▼▼ 修正: Checkboxを「済」スタンプに置き換え ▼▼▼ */}
                  <ListItemIcon sx={{ minWidth: 40, height: 28, alignItems: 'center', justifyContent: 'center' }}>
                    {task.completed ? <Stamp>済</Stamp> : <Box sx={{ width: 28 }} />}
                  </ListItemIcon>
                  {/* ▲▲▲ 修正 ▲▲▲ */}
                  <ListItemText 
                    id={labelId} 
                    primary={task.text} 
                  />
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
      </Box>
    </Pane>
  );
}
export default WorkflowList;