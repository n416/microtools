import React, { useEffect, useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, Button, Tooltip 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface ImageGenModalProps {
  open: boolean;
  onClose: () => void;
  prompt: string;
  onPasteImage: (files: FileList) => void;
}

const ImageGenModal: React.FC<ImageGenModalProps> = ({ open, onClose, prompt, onPasteImage }) => {
  const [copied, setCopied] = useState(false);

  // モーダルが開くたびにコピー状態をリセット
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);
  
  // ペースト検知 (前回修正分)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!open) return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        e.preventDefault();
        onPasteImage(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, onPasteImage]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onPasteImage(e.dataTransfer.files);
    }
  };

  // 手動コピー機能
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'success.light' }}>
          <ImageIcon /> 画像生成
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">プロンプト</Typography>
            <Tooltip title={copied ? "コピーしました！" : "クリップボードにコピー"}>
              <Button 
                size="small" 
                startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />} 
                onClick={handleCopyPrompt}
                color={copied ? "success" : "primary"}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </Tooltip>
          </Box>
          <Box sx={{ 
            p: 2, bgcolor: '#0f172a', border: '1px solid', borderColor: 'divider', borderRadius: 1,
            color: '#4ade80', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all'
          }}>
            {prompt}
          </Box>
        </Box>

        <Box 
          sx={{ 
            height: 200, border: '2px dashed', borderColor: 'success.main', 
            bgcolor: 'rgba(74, 222, 128, 0.1)', borderRadius: 2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: '0.2s',
            '&:hover': { bgcolor: 'rgba(74, 222, 128, 0.2)' }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
          <Typography variant="h6" color="success.light" fontWeight="bold">
            画像を貼り付け (Ctrl+V)
          </Typography>
          <Typography variant="caption" color="text.secondary">
            または生成された画像をここへドロップ
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default ImageGenModal;