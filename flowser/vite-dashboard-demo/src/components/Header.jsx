import React from 'react';
import { Paper, Typography, Button, Box, IconButton, Tabs, Tab } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

function Header({ onResetData, isLocked, onToggleLock }) {
  const location = useLocation();

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Typography variant="h5" component="h1">
          業務改善デモアプリ
        </Typography>
        <Tabs value={location.pathname} sx={{ minHeight: 0, '& .MuiTabs-indicator': { height: 3 } }}>
          <Tab 
            label="顧客管理" 
            value="/" 
            to="/" 
            component={Link} 
            sx={{ py: 1, minHeight: 0 }}
          />
          <Tab 
            label="AIフロー設計" 
            value="/designer" 
            to="/designer" 
            component={Link}
            sx={{ py: 1, minHeight: 0 }}
          />
        </Tabs>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {location.pathname === '/' && onToggleLock && (
           <IconButton onClick={onToggleLock} aria-label="toggle customer list lock">
             {isLocked ? <LockIcon /> : <LockOpenIcon />}
           </IconButton>
        )}
        <Button
          variant="outlined"
          color="error"
          startIcon={<RestartAltIcon />}
          onClick={onResetData}
        >
          データリセット
        </Button>
      </Box>
    </Paper>
  );
}

export default Header;