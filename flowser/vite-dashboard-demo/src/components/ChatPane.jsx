import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography, TextField, Button, Avatar, Stack, Chip, CircularProgress, Alert, AlertTitle } from '@mui/material';
import { styled } from '@mui/material/styles';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';


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
  maxWidth: '85%',
  backgroundColor: sender === 'user' ? theme.palette.primary.main : theme.palette.background.paper,
  color: sender === 'user' ? theme.palette.primary.contrastText : theme.palette.text.primary,
  border: sender === 'ai' ? `1px solid ${theme.palette.divider}` : 'none',
}));

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
      <Typography variant="h6" gutterBottom>AIフロー設計</Typography>
      <MessagesContainer>
        {chatHistory.map((msg, index) => {
          const isWarning = msg.text.startsWith('[WARNING]');
          const messageText = isWarning ? msg.text.replace('[WARNING]', '').trim() : msg.text;

          return (
            <MessageBubble key={index} sender={msg.sender}>
              <Avatar sx={{ mr: 1, bgcolor: msg.sender === 'ai' ? 'secondary.main' : 'primary.main' }}>
                {msg.sender === 'ai' ? <SmartToyIcon /> : <AccountCircleIcon />}
              </Avatar>
              <Box>
                {isWarning ? (
                  <Alert severity="warning" icon={<WarningAmberIcon fontSize="inherit" />} sx={{ borderRadius: '20px', maxWidth: '85%', bgcolor: '#fff4e5' }}>
                    <AlertTitle sx={{fontWeight: 'bold'}}>フェーズ逸脱警告</AlertTitle>
                    {messageText}
                  </Alert>
                ) : (
                  <MessageContent sender={msg.sender}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{messageText}</Typography>
                  </MessageContent>
                )}
                {msg.options && msg.options.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', justifyContent: 'flex-start', ml: 1 }}>
                    {msg.options.filter(opt => opt && opt.label && opt.label.trim() !== '').map((opt) => (
                      <Chip
                        key={opt.value || opt.label}
                        label={opt.label}
                        onClick={() => onSendMessage(opt.label)}
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
          );
        })}
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