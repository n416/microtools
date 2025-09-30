import React from 'react';
import { Paper, Typography, Box, IconButton, Tabs, Tab, Chip } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

// ▼▼▼ 修正: onResetDataをpropsから削除 ▼▼▼
function Header({ isLocked, onToggleLock }) {
  const location = useLocation();
  const TABS = ['/', '/designer'];

  return (
    <Paper 
      elevation={2} 
      sx={{ p: '12px 24px', mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Typography variant="h5" component="h1">
          業務改善デモアプリ
        </Typography>

        {!isLocked && (
          <Tabs value={TABS.includes(location.pathname) ? location.pathname : false} sx={{ minHeight: 0, '& .MuiTabs-indicator': { height: 3 } }}>
            <Tab label="顧客管理" value="/" to="/" component={Link} sx={{ py: 1, minHeight: 0 }} />
            <Tab label="AIフロー設計" value="/designer" to="/designer" component={Link} sx={{ py: 1, minHeight: 0 }} />
          </Tabs>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {!isLocked && (
            <>
                <Chip icon={<AccountCircleIcon />} label="ログイン中" variant="outlined" size="small" />
                <IconButton component={Link} to="/settings" aria-label="settings">
                    <SettingsIcon />
                </IconButton>
            </>
        )}
        {location.pathname === '/' && onToggleLock && (
           <IconButton onClick={onToggleLock} aria-label="toggle customer list lock">
             {isLocked ? <LockIcon /> : <LockOpenIcon />}
           </IconButton>
        )}
        {/* ▼▼▼ 修正: データリセットボタンを削除 ▼▼▼ */}
        {/* ▲▲▲ 修正 ▲▲▲ */}
      </Box>
    </Paper>
  );
}

export default Header;