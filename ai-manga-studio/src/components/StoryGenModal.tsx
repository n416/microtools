import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Typography, Box, IconButton, Paper 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface StoryGenModalProps {
  open: boolean;
  onClose: () => void;
  prompt: string;
  onImport: (json: string) => void;
}

const StoryGenModal: React.FC<StoryGenModalProps> = ({ open, onClose, prompt, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
  };

  const handleImportClick = () => {
    if (!jsonInput.trim()) return;
    onImport(jsonInput);
    setJsonInput(''); // Clear after import
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        物語生成 (Prompt & Import)
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        {/* Prompt Section */}
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="primary">プロンプト (LLMに貼り付け)</Typography>
            <Button startIcon={<ContentCopyIcon />} size="small" onClick={handleCopy}>コピー</Button>
          </Box>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#0f172a', color: '#4ade80', fontFamily: 'monospace', fontSize: '0.75rem', maxHeight: 150, overflowY: 'auto' }}>
            {prompt}
          </Paper>
        </Box>

        {/* JSON Input Section */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            AIからのレスポンス (JSON) を貼り付け
          </Typography>
          <TextField
            multiline
            rows={8}
            fullWidth
            variant="outlined"
            placeholder='{ "title": "...", "pages": [...] }'
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">キャンセル</Button>
        <Button onClick={handleImportClick} variant="contained" startIcon={<CheckIcon />}>
          取り込み完了
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StoryGenModal;