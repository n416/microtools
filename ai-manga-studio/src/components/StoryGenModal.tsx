import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, TextField, Typography, Box, IconButton, Paper, Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';

interface StoryGenModalProps {
  open: boolean;
  onClose: () => void;
  prompt: string;
  onImport: (json: string, keepOpen: boolean) => void;
}

const StoryGenModal: React.FC<StoryGenModalProps> = ({ open, onClose, prompt, onImport }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [parsedStory, setParsedStory] = useState<any>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
  };

  // ★追加: 採用（保存して継続）
  const handleAdopt = () => {
    if (!jsonInput.trim()) return;
    onImport(jsonInput, true);
    setJsonInput(''); // クリアして次の生成へ
  };

  // ★追加: 不要（クリアのみ）
  const handleDiscard = () => {
    if (window.confirm('入力内容をクリアしますか？')) {
      setJsonInput('');
    }
  };

  // ★追加: すぐ読む（プレビュー）
  const handleReadNow = () => {
    try {
      let clean = jsonInput.trim().replace(/```json/g, '').replace(/```/g, '');
      const s = clean.indexOf('{');
      const e = clean.lastIndexOf('}');
      if (s > -1 && e > -1) clean = clean.substring(s, e + 1);
      
      const data = JSON.parse(clean);
      setParsedStory(data);
      setPreviewOpen(true);
    } catch (e) {
      alert("JSONを正しく解析できませんでした。貼り付け内容を確認してください。");
    }
  };

  return (
    <>
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

        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Box>
             {/* 左側: サブアクション */}
             <Button onClick={handleDiscard} color="error" startIcon={<DeleteOutlineIcon />}>
               不要 (クリア)
             </Button>
          </Box>
          <Stack direction="row" spacing={2}>
            <Button onClick={handleReadNow} variant="outlined" color="info" startIcon={<MenuBookIcon />} disabled={!jsonInput.trim()}>
              すぐ読む
            </Button>
            <Button onClick={handleAdopt} variant="contained" color="success" startIcon={<SaveIcon />} disabled={!jsonInput.trim()}>
              採用 (保存して継続)
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* ラノベ風プレビューモーダル */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="sm" fullWidth scroll="paper">
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              {parsedStory?.title || "No Title"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              プレビューモード
            </Typography>
          </Box>
          <IconButton onClick={() => setPreviewOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 4, bgcolor: '#fffbf0', color: '#333' }}>
           {/* ラノベ風スタイル: 明朝体、縦書きはブラウザ互換性が難しいので横書きだが雰囲気重視 */}
           <Box sx={{ fontFamily: '"Shippori Mincho", "Hiragino Mincho ProN", serif' }}>
             <Typography variant="body2" sx={{ color: '#666', fontStyle: 'italic', mb: 4, whiteSpace: 'pre-wrap' }}>
               {parsedStory?.synopsis}
             </Typography>

             {parsedStory?.pages?.map((page: any, idx: number) => (
               <Box key={idx} sx={{ mb: 3 }}>
                 <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#555', fontSize: '0.9rem', mb: 1 }}>
                   {page.sceneDescription}
                 </Typography>
                 <Typography variant="body1" sx={{ fontSize: '1.1rem', lineHeight: 1.8, pl: 1, borderLeft: '4px solid #ddd' }}>
                   「{page.dialogue}」
                 </Typography>
               </Box>
             ))}
           </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>閉じる</Button>
          <Button onClick={() => { setPreviewOpen(false); handleAdopt(); }} variant="contained" color="success">
            これで採用する
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default StoryGenModal;