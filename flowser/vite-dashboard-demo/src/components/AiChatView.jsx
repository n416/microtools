import React from 'react';
import { Box } from '@mui/material';
// ▼▼▼ 【変更】 ReactFlowProviderのインポートを削除します ▼▼▼
// import { ReactFlowProvider } from 'reactflow'; 
import ChatPane from './ChatPane';
import FlowchartPane from './FlowchartPane';

function AiChatView({ chatHistory, nodes, edges, onSendMessage, onOptionSelect, isWaitingForUserInput }) {
  return (
    // ▼▼▼ 【変更】 Providerを削除し、Boxを最上位に戻します ▼▼▼
    <Box sx={{ flexGrow: 1, p: '0 24px 24px 24px', display: 'flex', gap: 2, minHeight: 0 }}>
      <Box sx={{ flex: '1 1 40%', minWidth: 400 }}>
        <ChatPane
          chatHistory={chatHistory}
          onSendMessage={onSendMessage}
          onOptionSelect={onOptionSelect}
          isWaitingForUserInput={isWaitingForUserInput}
        />
      </Box>
      <Box sx={{ flex: '1 1 60%', minWidth: 500 }}>
        <FlowchartPane nodes={nodes} edges={edges} />
      </Box>
    </Box>
  );
}

export default AiChatView;