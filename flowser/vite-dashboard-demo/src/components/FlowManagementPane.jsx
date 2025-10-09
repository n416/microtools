import { Box } from '@mui/material';
import CategoryManagementPane from './CategoryManagementPane';
import FlowListPane from './FlowListPane';

function FlowManagementPane({ onStartAiDesign }) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ flex: '0 1 40%', minHeight: 200 }}>
        <CategoryManagementPane />
      </Box>
      <Box sx={{ flex: '1 1 60%' }}>
        <FlowListPane onStartAiDesign={onStartAiDesign} />
      </Box>
    </Box>
  );
}

export default FlowManagementPane;