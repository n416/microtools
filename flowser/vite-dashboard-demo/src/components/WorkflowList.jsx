import React from 'react';
import { 
  Paper, Typography, Box, List, ListItem, 
  ListItemText, Checkbox, Button, ListItemButton, ListItemIcon
} from '@mui/material';
import { styled } from '@mui/material/styles';

const Pane = styled(Paper)({
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minHeight: 0, 
});

function WorkflowList({ workflow, onToggleTask, onSelectTask }) {
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
              // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
              //
              // MUIの secondaryAction を完全に捨て去り、
              // 内部を純粋な Flexbox で再構築しました。
              // これで、二度とレイアウトは破綻しません。
              //
              // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
              <ListItem
                key={`${workflow.id}-${task.id}`}
                disablePadding
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', pl: 1 }}>
                  {/* --- クリック可能なテキスト部分 --- */}
                  <ListItemButton 
                    role={undefined} 
                    onClick={() => onToggleTask(task.id)}
                    sx={{ flexGrow: 1, p: '4px 8px' }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Checkbox
                        edge="start"
                        checked={task.completed}
                        tabIndex={-1}
                        disableRipple
                        inputProps={{ 'aria-labelledby': labelId }}
                      />
                    </ListItemIcon>
                    <ListItemText 
                      id={labelId} 
                      primary={task.text} 
                    />
                  </ListItemButton>
                  
                  {/* --- 詳細ボタン --- */}
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={() => onSelectTask(task.id)}
                    sx={{ flexShrink: 0, ml: 1, mr: 1 }}
                  >
                    詳細
                  </Button>
                </Box>
              </ListItem>
            );
          })}
        </List>
      </Box>
    </Pane>
  );
}
export default WorkflowList;