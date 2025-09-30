import React, { useState, useEffect } from 'react';
import {
  Paper, Box, Typography, IconButton, Divider, List, ListItem,
  ListItemIcon, Checkbox, ListItemText, ListItemButton, Stack, Button, TextField
} from '@mui/material';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { styled } from '@mui/material/styles';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { GeminiApiClient } from '../api/geminiApiClient.js';
import { useSelector, useDispatch } from 'react-redux';
import { startAiRefinement, setApiCommunicating } from '../store/workflowSlice';

const Pane = styled(Paper)({
  padding: '16px',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

function TaskDetailPane({ task, onToggleDocument, onToggleTask, onSelectBranch, onUpdateTaskMemo }) {
  const dispatch = useDispatch();
  const [memo, setMemo] = useState('');
  const [isGeminiAvailable, setIsGeminiAvailable] = useState(false);
  const [isAiRefining, setIsAiRefining] = useState(false);

  // AI整形に関わるグローバルな状態は、ここでも直接Storeから取得できる
  const { isApiCommunicating, selectedCustomerId, selectedWorkflowId } = useSelector(state => state.workflow);

  useEffect(() => {
    if (task) {
      setMemo(task.memo || '');
    }
    const gemini = new GeminiApiClient();
    setIsGeminiAvailable(gemini.isAvailable);
  }, [task]);

  const handleMemoBlur = () => {
    if (task && task.memo !== memo) {
      onUpdateTaskMemo(memo);
    }
  };

  const handleAiRefineMemo = async () => {
    if (!task || !memo.trim()) {
      alert('メモ内容が空です。');
      return;
    }
    setIsAiRefining(true);
    dispatch(setApiCommunicating(true));
    try {
      const gemini = new GeminiApiClient();
      const prompt = `あなたは優秀なアシスタントです。以下のタスク内容を踏まえ、メモの内容をより分かりやすく、簡潔に、かつ丁寧な言葉遣いに修正してください。\n\n# タスク内容\n${task.text}\n\n# メモの原文\n${memo}\n\n# 指示\n- 修正後のメモのテキストだけを出力してください。\n- 挨拶や前置き、「修正後のメモ:」といった見出し、markdownの装飾などは一切含めないでください。`;

      const resultText = await gemini.generateContent(prompt);

      dispatch(startAiRefinement({
        task,
        customerId: selectedCustomerId,
        workflowInstanceId: selectedWorkflowId,
        originalMemo: memo,
        suggestion: resultText.trim()
      }));

    } catch (error) {
      console.error('AI memo refinement failed:', error);
      alert(`AIによる整形に失敗しました: ${error.message}`);
      dispatch(setApiCommunicating(false));
    } finally {
      setIsAiRefining(false);
    }
  };

  if (!task) {
    return (
      <Pane>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            中央のリストからタスクを選択してください。
          </Typography>
        </Box>
      </Pane>
    );
  }

  return (
    <Pane>
      <Box>
        <Typography variant="h6">{task.text}</Typography>
        <Divider sx={{ my: 1 }} />

        {task.type === 'nested_branch' ? (
          <Box>
            <Stack spacing={1}>
              <Typography variant="subtitle2">プランを選択してください:</Typography>
              {Object.entries(task.options).map(([key, option]) => (
                <Button
                  key={key}
                  variant={task.selectedOption === key ? "contained" : "outlined"}
                  onClick={() => onSelectBranch(key)}
                >
                  {option.label}
                </Button>
              ))}
            </Stack>
          </Box>
        ) : (
          <ListItemButton
            onClick={onToggleTask}
            sx={{ borderRadius: 1, p: '4px 8px' }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <Checkbox
                edge="start"
                checked={!!task.completed}
                tabIndex={-1}
                disableRipple
              />
            </ListItemIcon>
            <ListItemText primary="このタスクを完了済みにする" />
          </ListItemButton>
        )}

      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
        <Typography variant="body1" sx={{ my: 2, whiteSpace: 'pre-wrap' }}>
          {task.details}
        </Typography>

        <Box sx={{ my: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 0 }}>
              📝 タスクメモ
            </Typography>
            {isGeminiAvailable && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighIcon />}
                onClick={handleAiRefineMemo}
                disabled={isAiRefining || isApiCommunicating}
              >
                {isAiRefining || isApiCommunicating ? '処理中...' : 'AI整形'}
              </Button>
            )}
          </Box>
          <TextField
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder="このタスクに関するメモを入力..."
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            onBlur={handleMemoBlur}
          />
        </Box>

        {task.documents && task.documents.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              関連書類
            </Typography>
            <List dense>
              {task.documents.map((doc) => (
                <ListItem
                  key={doc.name}
                  disablePadding
                  secondaryAction={
                    <IconButton edge="end" href={doc.url} target="_blank" sx={{ right: '8px' }}>
                      <FileDownloadOutlinedIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => onToggleDocument && onToggleDocument(doc.name)} sx={{ pr: '48px' }}>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={doc.checked}
                        tabIndex={-1}
                        disableRipple
                      />
                    </ListItemIcon>
                    <ListItemText primary={doc.name} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>
    </Pane>
  );
}
export default TaskDetailPane;