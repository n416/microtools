import { Box, Paper, Typography, Button } from '@mui/material';
import ChatPane from './ChatPane';
import FlowchartPane from './FlowchartPane';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';

function FlowDesignPane({ isActive, chatHistory, nodes, edges, onSendMessage, isWaitingForUserInput, isWaitingForAiResponse, onSave }) {
  if (!isActive) {
    return (
      <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, gap: 2, backgroundColor: 'action.hover' }}>
        <RocketLaunchIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary">
          AIフロー設計を開始
        </Typography>
        <Typography color="text.secondary" align="center">
          左のパネルから「AIで新しいフローを設計」ボタンを押し、<br />
          起点となる業務フェーズを選択してください。
        </Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', gap: 2 }}>
      <Box sx={{ flex: '1 1 40%', minWidth: 400 }}>
        <ChatPane
          chatHistory={chatHistory}
          onSendMessage={onSendMessage}
          isWaitingForUserInput={isWaitingForUserInput}
          isWaitingForAiResponse={isWaitingForAiResponse}
        />
      </Box>
      <Box sx={{ flex: '1 1 60%', minWidth: 500, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <FlowchartPane nodes={nodes} edges={edges} />
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Button variant="contained" onClick={onSave} disabled={nodes.length === 0}>
            フローとして保存
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default FlowDesignPane;