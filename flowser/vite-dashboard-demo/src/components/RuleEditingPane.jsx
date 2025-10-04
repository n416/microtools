import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

function RuleEditingPane() {
  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="h6">
        ルール編集画面
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
        (この機能はステップ3で実装されます)
      </Typography>
    </Paper>
  );
}

export default RuleEditingPane;