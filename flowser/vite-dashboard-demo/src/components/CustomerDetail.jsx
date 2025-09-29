import React, { useState } from 'react';
import { Paper, Typography, Box, Chip, Divider, Button, IconButton } from '@mui/material';
import { styled } from '@mui/material/styles';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

const Pane = styled(Paper)({
  padding: '16px',
  // ★★★ このパネルが伸び縮みしないように固定 ★★★
  flexShrink: 0,
});

const statusConfig = {
    critical: { label: '要対応', color: 'error' },
    progress: { label: '対応中', color: 'warning' },
    success: { label: '完了', color: 'success' },
    new: { label: '新規', color: 'default' },
};

function CustomerDetail({ customer, onOpenModal }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!customer) {
    return <Pane><Typography>顧客を選択してください</Typography></Pane>;
  }

  return (
    <Pane>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">顧客詳細</Typography>
        <IconButton onClick={() => setIsCollapsed(!isCollapsed)} size="small">
          {isCollapsed ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
        </IconButton>
      </Box>
      
      {!isCollapsed && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="h5">{customer.name}</Typography>
          <Typography variant="body1">{customer.company}</Typography>
          {statusConfig[customer.status] && (
            <Chip
              label={statusConfig[customer.status].label}
              color={statusConfig[customer.status].color}
              sx={{ mt: 1 }}
            />
          )}
          <Divider sx={{ my: 2 }} />
          <Button variant="contained" onClick={onOpenModal}>
            業務フローを割り当て
          </Button>
        </Box>
      )}
    </Pane>
  );
}
export default CustomerDetail;