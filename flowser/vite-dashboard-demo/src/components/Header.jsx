import React from 'react';
import { Paper, Typography, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

function Header({ onResetData }) {
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
      <Typography variant="h5" component="h1">
        業務改善デモアプリ
      </Typography>
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