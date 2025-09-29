import React from 'react';
import { Paper, Typography, Button, Box, IconButton } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

function Header({ onResetData, isLocked, onToggleLock }) {
  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: '12px 24px', 
        mb: 2, 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center' 
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h5" component="h1">
          業務改善デモアプリ
        </Typography>
        <IconButton onClick={onToggleLock} aria-label="toggle customer list lock">
          {isLocked ? <LockIcon /> : <LockOpenIcon />}
        </IconButton>
      </Box>
      <Button
        variant="outlined"
        color="error"
        startIcon={<RestartAltIcon />}
        onClick={onResetData}
      >
        データリセット
      </Button>
    </Paper>
  );
}

export default Header;