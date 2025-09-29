import React from 'react';
import {
  Paper, Box, Typography, IconButton, Divider, List, ListItem,
  ListItemIcon, Checkbox, ListItemText
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { styled } from '@mui/material/styles';

const Pane = styled(Paper)({
  padding: '16px',
  height: '100%', // ★★★ 親のGridに高さを委ねる
  display: 'flex',
  flexDirection: 'column',
});

function TaskDetailPane({ task, onToggleDocument }) {
  // ログは不要なため削除

  if (!task) {
    return (
      <Pane>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            中央のリストからタスクの「詳細」ボタンを押してください。
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
      </Box>
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
                    <IconButton edge="end" href={doc.url} target="_blank">
                      <FileDownloadOutlinedIcon />
                    </IconButton>
                  }
                >
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={doc.checked}
                      onChange={() => onToggleDocument(task.id, doc.name)}
                    />
                  </ListItemIcon>
                  <ListItemText primary={doc.name} />
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