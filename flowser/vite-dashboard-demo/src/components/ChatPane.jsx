import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Avatar, Stack, Chip, CircularProgress } from '@mui/material'; // CircularProgress をインポート
import { styled } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

const ChatContainer = styled(Paper)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: theme.spacing(2),
}));

const MessagesContainer = styled(Box)({
  flexGrow: 1,
  overflowY: 'auto',
  padding: '8px',
});

const MessageBubble = styled(Box)(({ theme, sender }) => ({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'flex-start',
  marginBottom: theme.spacing(2),
  justifyContent: sender === 'user' ? 'flex-end' : 'flex-start',
}));

const MessageContent = styled(Paper)(({ theme, sender }) => ({
  padding: theme.spacing(1, 2),
  borderRadius: '20px',
  maxWidth: '70%',
  backgroundColor: sender === 'user' ? theme.palette.primary.main : theme.palette.background.paper,
  color: sender === 'user' ? theme.palette.primary.contrastText : theme.palette.text.primary,
  border: sender === 'ai' ? `1px solid ${theme.palette.divider}` : 'none',
}));

// ▼▼▼ 【修正】 isWaitingForAiResponse を props に追加 ▼▼▼
function ChatPane({ chatHistory, onSendMessage, onOptionSelect, isWaitingForUserInput, isWaitingForAiResponse }) {
  const [userInput, setUserInput] = React.useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [chatHistory, isWaitingForAiResponse]);

  const handleSend = () => {
    if (userInput.trim()) {
      onSendMessage(userInput);
      setUserInput('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <ChatContainer>
      <Typography variant="h6" gutterBottom>AIチャット設計</Typography>
      <MessagesContainer>
        {chatHistory.map((msg, index) => (
          <MessageBubble key={index} sender={msg.sender}>
            <Avatar sx={{ mr: 1, bgcolor: msg.sender === 'ai' ? 'secondary.main' : 'primary.main' }}>
              {msg.sender === 'ai' ? <SmartToyIcon /> : <AccountCircleIcon />}
            </Avatar>
            <Box>
                <MessageContent sender={msg.sender}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{msg.text}</Typography>
                </MessageContent>
                {msg.options && msg.options.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', justifyContent: 'flex-start', ml:1 }}>
                        {msg.options.map((opt) => (
                            <Chip
                                key={opt.value}
                                label={opt.label}
                                onClick={() => onSendMessage(opt.label)} // オプションクリック時も onSendMessage を呼ぶ
                                color="info"
                                clickable={isWaitingForUserInput}
                                disabled={!isWaitingForUserInput}
                                variant="outlined"
                            />
                        ))}
                    </Stack>
                )}
            </Box>
          </MessageBubble>
        ))}
        {/* ▼▼▼ 【追加】 AI応答待ちのインジケーター ▼▼▼ */}
        {isWaitingForAiResponse && (
            <MessageBubble sender="ai">
                <Avatar sx={{ mr: 1, bgcolor: 'secondary.main' }}>
                    <SmartToyIcon />
                </Avatar>
                <Box>
                    <MessageContent sender="ai">
                        <CircularProgress size={20} />
                    </MessageContent>
                </Box>
            </MessageBubble>
        )}
        <div ref={messagesEndRef} />
      </MessagesContainer>
      <Box sx={{ display: 'flex', pt: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="メッセージを入力..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={!isWaitingForUserInput}
        />
        <Button
            variant="contained"
            onClick={handleSend}
            sx={{ ml: 1 }}
            disabled={!isWaitingForUserInput}
        >
          送信
        </Button>
      </Box>
    </ChatContainer>
  );
}

export default ChatPane;