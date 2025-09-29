import React from 'react';
import { Paper, Typography, List, ListItemButton, ListItemText, Chip } from '@mui/material';
import { styled } from '@mui/material/styles';

const Pane = styled(Paper)({
  padding: '16px',
  height: '100%',
  overflow: 'auto',
});

const statusConfig = {
    critical: { label: '要対応', color: 'error' },
    progress: { label: '対応中', color: 'warning' },
    success: { label: '完了', color: 'success' },
    new: { label: '新規', color: 'default' },
};

function CustomerList({ customers, selectedCustomerId, onSelectCustomer }) {
  return (
    <Pane>
      <Typography variant="h6" gutterBottom>
        顧客リスト
      </Typography>
      <List>
        {customers.map((customer) => (
          <ListItemButton
            key={customer.id}
            selected={selectedCustomerId === customer.id}
            onClick={() => onSelectCustomer(customer.id)}
          >
            <ListItemText primary={customer.name} secondary={customer.company} />
            {statusConfig[customer.status] && (
              <Chip
                label={statusConfig[customer.status].label}
                color={statusConfig[customer.status].color}
                size="small"
              />
            )}
          </ListItemButton>
        ))}
      </List>
    </Pane>
  );
}

export default CustomerList;