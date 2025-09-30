import React from 'react';
import {
  Paper, Box, Typography, IconButton, Divider, List, ListItem,
  ListItemIcon, Checkbox, ListItemText, ListItemButton
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { styled } from '@mui/material/styles';

const Pane = styled(Paper)({
  padding: '16px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

function TaskDetailPane({ task, onToggleDocument, onToggleTask }) {
  if (!task) {
    return (
      <Pane>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            中央のリストからタスクを選択してください。
          </Typography>
        </Box>
      </Pane>
    );
  }

  return (
    <Pane>
      <Box>
        <Typography variant="h6">{task.text}</Typography>
        <Divider sx={{ my: 1 }} />
        {/* ▼▼▼ 修正: ListItemButtonで行全体をクリック可能に修正 ▼▼▼ */}
        <ListItemButton 
          onClick={() => onToggleTask && onToggleTask(task.id)}
          sx={{ borderRadius: 1, p: '4px 8px' }}
        >
          <ListItemIcon sx={{minWidth: 40}}>
             <Checkbox
                edge="start"
                checked={!!task.completed}
                tabIndex={-1}
                disableRipple
              />
          </ListItemIcon>
          <ListItemText primary="このタスクを完了済みにする" />
        </ListItemButton>
        {/* ▲▲▲ 修正 ▲▲▲ */}
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <Typography variant="body1" sx={{ my: 2, whiteSpace: 'pre-wrap' }}>
          {task.details}
        </Typography>
        {task.documents && task.documents.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              関連書類
            </Typography>
            <List dense>
              {task.documents.map((doc) => (
                <ListItem
                  key={doc.name}
                  disablePadding
                  secondaryAction={
                    <IconButton edge="end" href={doc.url} target="_blank" sx={{ right: '8px' }}>
                      <FileDownloadOutlinedIcon />
                    </IconButton>
                  }
                >
                  {/* ▼▼▼ 修正: ListItemButtonで行全体をクリック可能に修正 ▼▼▼ */}
                  <ListItemButton onClick={() => onToggleDocument(task.id, doc.name)} sx={{ pr: '48px' }}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={doc.checked}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText primary={doc.name} />
                  </ListItemButton>
                  {/* ▲▲▲ 修正 ▲▲▲ */}
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Pane>
  );
}
export default TaskDetailPane;