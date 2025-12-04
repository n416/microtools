import os

files_content = {}

# src/features/editor/StoryEditor.tsx
# 不足していた ListItemIcon, ListItemText, Link を追加
files_content['src/features/editor/StoryEditor.tsx'] = """import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Chip, IconButton, Stack, CircularProgress, 
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, 
  Switch, ToggleButtonGroup, ToggleButton, Divider, TextField, Tooltip, Snackbar, Alert, Link
} from '@mui/material';
import { v4 as uuidv4 } from 'uuid';

// Icons
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import CompressIcon from '@mui/icons-material/Compress';
import HighQualityIcon from '@mui/icons-material/HighQuality';
import DownloadIcon from '@mui/icons-material/Download';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import InsertPhotoIcon from '@mui/icons-material/InsertPhoto';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import MovieIcon from '@mui/icons-material/Movie';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DeleteIcon from '@mui/icons-material/Delete';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import LaunchIcon from '@mui/icons-material/Launch';
import ArrowBackIconSmall from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCurrentProject, updateProjectAsset, addStoryBlock, removeStoryBlock, updateBlockPrompt } from '../projects/projectSlice';
import { addAsset } from '../assets/assetSlice';

// Components & Utils
import ImageGenModal from '../../components/ImageGenModal';
import MangaViewer from '../../components/MangaViewer';
import DirectorsWizard from '../../components/DirectorsWizard';
import { generatePDF } from '../../utils/pdfExporter';
import type { PDFExportOptions } from '../../utils/pdfExporter';
import { generateImages } from '../../utils/imageExporter';
import type { AspectRatio } from '../../utils/imageExporter';
import { ImageBlock, VideoBlock } from '../../types';

interface StoryEditorProps {
  getAssetUrl: (id: string | null) => string | undefined;
}

// 定型文リスト
const PROMPT_SNIPPETS = [
  "Cinematic Lighting, 8k, Unreal Engine 5 render",
  "Anime Style, Makoto Shinkai style vibrant colors, highly detailed",
  "Studio Ghibli style, hand drawn animation, peaceful atmosphere",
  "Cyberpunk atmosphere, neon lights, rain, high contrast",
  "Slow motion, high frame rate, smooth transition",
  "Dynamic camera movement, zoom in, tracking shot"
];

const StoryEditor: React.FC<StoryEditorProps> = ({ getAssetUrl }) => {
  const dispatch = useAppDispatch();
  const project = useAppSelector(state => state.projects.currentProject);
  const allAssets = useAppSelector(state => state.assets.items);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [targetId, setTargetId] = useState<'cover' | string>('cover');

  // PDF Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [pdfMenuAnchor, setPdfMenuAnchor] = useState<null | HTMLElement>(null);

  // Image Export Modal State
  const [imgExportOpen, setImgExportOpen] = useState(false);
  const [exportRatio, setExportRatio] = useState<AspectRatio>('9:16');
  const [exportWithText, setExportWithText] = useState(true);
  const [exportMode, setExportMode] = useState<'zip' | 'single'>('zip');

  // --- Ticket #5 Directors Wizard State ---
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTargetIndex, setWizardTargetIndex] = useState<number | null>(null);

  // Magic Wand Menu (For compatibility if needed, but replaced by Wizard)
  const [magicMenuAnchor, setMagicMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Snippet Menu
  const [snippetMenuAnchor, setSnippetMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSnippetBlockId, setActiveSnippetBlockId] = useState<string | null>(null);

  // External Links Notification
  const [linkSnackbarOpen, setLinkSnackbarOpen] = useState(false);

  if (!project) return null;

  // --- Handlers ---

  const handleBack = () => {
    dispatch(setCurrentProject(null));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // PDF Export
  const handlePdfMenuOpen = (e: React.MouseEvent<HTMLElement>) => setPdfMenuAnchor(e.currentTarget);
  const handlePdfMenuClose = () => setPdfMenuAnchor(null);
  
  const handleExportPDF = async (options: PDFExportOptions) => {
    handlePdfMenuClose();
    setIsExporting(true);
    setExportMessage("PDF準備中...");
    setTimeout(async () => {
      await generatePDF(project, allAssets, (msg) => setExportMessage(msg), options);
      setIsExporting(false);
      setExportMessage('');
    }, 100);
  };

  // Image Export
  const handleImageExport = async () => {
    setImgExportOpen(false);
    setIsExporting(true);
    setExportMessage("画像生成中...");
    
    setTimeout(async () => {
      await generateImages(
        project, 
        allAssets, 
        { ratio: exportRatio, withText: exportWithText, mode: exportMode }, 
        (msg) => setExportMessage(msg)
      );
      setIsExporting(false);
      setExportMessage('');
    }, 100);
  };

  // Image Gen Handlers
  const handleGenStart = (prompt: string, target: 'cover' | string) => {
    const fullPrompt = `(Masterpiece, Best Quality), Manga Style. ${prompt}`;
    setCurrentPrompt(fullPrompt);
    setTargetId(target);
    setModalOpen(true);
  };

  const handleGenFinish = async (files: FileList) => {
    if (files.length > 0) {
      const action = await dispatch(addAsset({ file: files[0], category: 'generated' }));
      if (addAsset.fulfilled.match(action)) {
        const newAssetId = action.payload.id;
        dispatch(updateProjectAsset({
          projectId: project.id,
          type: targetId === 'cover' ? 'cover' : 'block',
          blockId: targetId !== 'cover' ? targetId : undefined,
          assetId: newAssetId
        }));
        setModalOpen(false);
      }
    }
  };

  const handleDropAssign = async (e: React.DragEvent, target: 'cover' | string) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (assetId) {
      dispatch(updateProjectAsset({
        projectId: project.id,
        type: target === 'cover' ? 'cover' : 'block',
        blockId: target !== 'cover' ? target : undefined,
        assetId: assetId
      }));
    } else if (e.dataTransfer.files.length > 0) {
      const action = await dispatch(addAsset({ file: e.dataTransfer.files[0], category: 'material' }));
      if (addAsset.fulfilled.match(action)) {
        dispatch(updateProjectAsset({
          projectId: project.id,
          type: target === 'cover' ? 'cover' : 'block',
          blockId: target !== 'cover' ? target : undefined,
          assetId: action.payload.id
        }));
      }
    }
  };

  // --- Story Block Manipulation ---

  const handleAddVideoBlock = (index: number) => {
    const newBlock: VideoBlock = {
      id: uuidv4(),
      type: 'video',
      prompt: '',
      assignedAssetId: null
    };
    dispatch(addStoryBlock({ projectId: project.id, index, block: newBlock }));
  };

  const handleRemoveBlock = (blockId: string) => {
    if(window.confirm('このブロックを削除しますか？')) {
      dispatch(removeStoryBlock({ projectId: project.id, blockId }));
    }
  };

  // --- Ticket #5: Open Wizard ---
  const handleOpenWizard = (index: number) => {
    setWizardTargetIndex(index);
    setWizardOpen(true);
  };

  const handleWizardConfirm = (prompt: string) => {
    if (wizardTargetIndex !== null) {
      const block = project.storyboard[wizardTargetIndex];
      dispatch(updateBlockPrompt({ projectId: project.id, blockId: block.id, prompt }));
      setLinkSnackbarOpen(true); 
    }
  };

  // --- Snippets ---

  const handleSnippetMenuOpen = (e: React.MouseEvent<HTMLElement>, blockId: string) => {
    setSnippetMenuAnchor(e.currentTarget);
    setActiveSnippetBlockId(blockId);
  };

  const handleSnippetMenuClose = () => {
    setSnippetMenuAnchor(null);
    setActiveSnippetBlockId(null);
  };

  const handleApplySnippet = (snippet: string) => {
    if (!activeSnippetBlockId) return;
    const block = project.storyboard.find(b => b.id === activeSnippetBlockId) as VideoBlock;
    if (block) {
        const newPrompt = block.prompt ? `${block.prompt}, ${snippet}` : snippet;
        dispatch(updateBlockPrompt({ projectId: project.id, blockId: activeSnippetBlockId, prompt: newPrompt }));
    }
    handleSnippetMenuClose();
  };

  // --- Render Helpers ---

  const renderImagePlaceholder = (assetId: string | null, onClick: () => void, onDrop: (e: React.DragEvent) => void, label: string) => {
    const url = getAssetUrl(assetId);
    return (
      <Box
        sx={{
          width: 140, aspectRatio: '2/3', bgcolor: 'black', borderRadius: 1,
          border: url ? '1px solid' : '2px dashed',
          borderColor: url ? 'divider' : 'text.disabled',
          overflow: 'hidden', cursor: 'pointer', position: 'relative', flexShrink: 0,
          '&:hover': { borderColor: 'primary.main' }
        }}
        onClick={onClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        {url ? (
          <Box component="img" src={url} alt="asset" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.disabled', p: 1, textAlign: 'center' }}>
            <ImageIcon />
            <Typography variant="caption">{label}</Typography>
          </Box>
        )}
      </Box>
    );
  };

  const renderVideoBlock = (block: VideoBlock, index: number) => {
    const url = getAssetUrl(block.assignedAssetId);

    return (
      <Paper 
        key={block.id} 
        variant="outlined" 
        sx={{ 
          p: 2, display: 'flex', gap: 2, bgcolor: '#0f172a', borderColor: 'primary.dark',
          borderStyle: 'dashed', position: 'relative'
        }}
      >
        <Box sx={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 1, color: 'primary.main' }}>
          <MovieIcon />
        </Box>
        
        {/* Video Preview / Dropzone */}
        <Box
          sx={{
             width: 240, aspectRatio: '16/9', bgcolor: 'black', borderRadius: 1,
             border: url ? '1px solid' : '2px dashed',
             borderColor: url ? 'primary.main' : 'text.disabled',
             overflow: 'hidden', position: 'relative', flexShrink: 0,
             display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDropAssign(e, block.id)}
        >
           {url ? (
             <video src={url} loop muted autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
           ) : (
             <Typography variant="caption" color="text.disabled">Drop Video Here</Typography>
           )}
        </Box>

        {/* Controls */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
           <Box sx={{ display: 'flex', gap: 1 }}>
             <TextField 
                fullWidth size="small" multiline maxRows={3} 
                placeholder="Video Prompt..."
                value={block.prompt}
                onChange={(e) => dispatch(updateBlockPrompt({ projectId: project.id, blockId: block.id, prompt: e.target.value }))}
                sx={{ 
                  '& .MuiOutlinedInput-root': { color: 'primary.light', fontFamily: 'monospace', fontSize: '0.8rem' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(99, 102, 241, 0.3)' }
                }}
             />
             <Tooltip title="定型文を挿入">
                <Button 
                    variant="outlined" sx={{ minWidth: 40, px: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                    onClick={(e) => handleSnippetMenuOpen(e, block.id)}
                >
                    <FormatQuoteIcon fontSize="small" />
                </Button>
             </Tooltip>
             <Tooltip title="Director's Wizard (演出ウィザードを開く)">
               <Button 
                 variant="contained" color="primary" sx={{ minWidth: 40, px: 1 }} 
                 onClick={() => handleOpenWizard(index)}
               >
                 <AutoFixHighIcon fontSize="small" />
               </Button>
             </Tooltip>
           </Box>
           <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
             <Button 
               size="small" color="error" startIcon={<DeleteIcon />} 
               onClick={() => handleRemoveBlock(block.id)}
             >
               削除
             </Button>
           </Box>
        </Box>
      </Paper>
    );
  };

  const renderAddBridge = (index: number) => (
    <Box sx={{ display: 'flex', alignItems: 'center', py: 1.5 }}>
       <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
       <Button 
         size="small" variant="outlined" startIcon={<AddCircleOutlineIcon />}
         onClick={() => handleAddVideoBlock(index)}
         sx={{ 
            mx: 2, borderRadius: 10, px: 2, textTransform: 'none',
            borderColor: 'rgba(255,255,255,0.1)', 
            color: 'text.secondary',
            fontSize: '0.75rem',
            '&:hover': { 
                borderColor: 'primary.main', 
                color: 'primary.main',
                bgcolor: 'rgba(99, 102, 241, 0.05)' 
            }
         }}
       >
         動画を追加
       </Button>
       <Divider sx={{ flex: 1, borderColor: 'rgba(255,255,255,0.05)' }} />
    </Box>
  );

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 3, paddingBottom: '8rem' }}>
      
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: 'text.secondary' }}>
          リストに戻る
        </Button>
        <Stack direction="row" spacing={2}>
          <Button 
            variant="outlined" color="info" startIcon={<DownloadIcon />}
            onClick={() => setImgExportOpen(true)} disabled={isExporting}
          >
            {isExporting ? exportMessage : "画像DL"}
          </Button>
          <Box>
            <Button 
              variant="outlined" color="primary"
              startIcon={isExporting ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
              endIcon={!isExporting && <KeyboardArrowDownIcon />}
              onClick={handlePdfMenuOpen} disabled={isExporting}
            >
              PDF出力
            </Button>
            <Menu anchorEl={pdfMenuAnchor} open={Boolean(pdfMenuAnchor)} onClose={handlePdfMenuClose}>
              <MenuItem onClick={() => handleExportPDF({ scale: 2, quality: 0.9 })}>
                <ListItemIcon><HighQualityIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="高画質 (通常)" />
              </MenuItem>
              <MenuItem onClick={() => handleExportPDF({ scale: 1, quality: 0.6, filenameSuffix: '_light' })}>
                <ListItemIcon><CompressIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="軽量版 (圧縮)" />
              </MenuItem>
            </Menu>
          </Box>
          <Button variant="contained" color="success" startIcon={<PlayCircleOutlineIcon />} onClick={() => setViewerOpen(true)}>
            プレビュー
          </Button>
        </Stack>
      </Box>

      {/* Main Editor Content */}
      <Paper variant="outlined" sx={{ p: 0, mb: 4, overflow: 'hidden', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', background: 'linear-gradient(to bottom right, #0f172a, rgba(49, 46, 129, 0.2))' }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>{project.title}</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label={project.gachaResult.themeA} color="primary" variant="outlined" size="small" />
            <Chip label={project.gachaResult.themeB} color="primary" variant="outlined" size="small" />
            <Chip label={`★ ${project.gachaResult.secretIngredient}`} color="warning" variant="outlined" size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', borderLeft: 3, borderColor: 'primary.main', pl: 1 }}>
            {project.synopsis}
          </Typography>
        </Box>
        <Box sx={{ p: 3, display: 'flex', gap: 3 }}>
          {renderImagePlaceholder(project.coverAssetId, () => handleGenStart(project.coverImagePrompt, 'cover'), (e) => handleDropAssign(e, 'cover'), "表紙生成")}
          <Box sx={{ flex: 1, bgcolor: 'rgba(2, 6, 23, 0.3)', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>EDITOR'S NOTE</Typography>
            <Typography variant="body2" color="text.secondary">{project.editorNote}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Storyboard Loop */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>ストーリーボード (全{project.storyboard.length}ブロック)</Typography>
      <Stack spacing={0}>
        {project.storyboard.map((block, idx) => {
          const isImage = block.type === 'image';
          return (
             <React.Fragment key={block.id}>
               {isImage ? (
                  <Paper variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, '&:hover': { borderColor: 'text.secondary' } }}>
                    <Typography variant="h5" fontWeight="bold" color="text.disabled" sx={{ width: 40, textAlign: 'center', pt: 1 }}>{(block as ImageBlock).pageNumber}</Typography>
                    {renderImagePlaceholder(block.assignedAssetId, () => handleGenStart((block as ImageBlock).imagePrompt, block.id), (e) => handleDropAssign(e, block.id), "画像生成")}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{(block as ImageBlock).sceneDescription}</Typography>
                      <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: '#020617', borderLeft: 3, borderColor: 'primary.main' }}><Typography variant="body2" color="primary.light">{(block as ImageBlock).dialogue}</Typography></Paper>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" fontFamily="monospace" color="text.disabled" noWrap sx={{ maxWidth: '80%', bgcolor: 'rgba(255,255,255,0.05)', px: 1, borderRadius: 0.5 }}>{(block as ImageBlock).imagePrompt}</Typography>
                        <IconButton size="small" onClick={() => copyToClipboard((block as ImageBlock).imagePrompt)}><ContentCopyIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                  </Paper>
               ) : (
                  renderVideoBlock(block as VideoBlock, idx)
               )}
               {renderAddBridge(idx + 1)}
             </React.Fragment>
          );
        })}
      </Stack>

      {/* Snippet Menu */}
      <Menu
        anchorEl={snippetMenuAnchor}
        open={Boolean(snippetMenuAnchor)}
        onClose={handleSnippetMenuClose}
      >
        <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>スタイル定型文を挿入</Typography>
        <Divider />
        {PROMPT_SNIPPETS.map((text, i) => (
            <MenuItem key={i} onClick={() => handleApplySnippet(text)} sx={{ fontSize: '0.85rem' }}>
                {text}
            </MenuItem>
        ))}
      </Menu>

      {/* Link Launcher Snackbar */}
      <Snackbar 
        open={linkSnackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => setLinkSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
            onClose={() => setLinkSnackbarOpen(false)} 
            severity="success" 
            sx={{ width: '100%', alignItems: 'center' }}
            icon={<ContentCopyIcon />}
        >
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">プロンプトを更新しました</Typography>
                <Typography variant="caption" display="block" mb={1}>外部サイトを開いて生成:</Typography>
                <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://app.runwayml.com" target="_blank">Runway</Button>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://lumalabs.ai/dream-machine" target="_blank">Luma</Button>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://klingai.com" target="_blank">Kling</Button>
                </Stack>
            </Box>
        </Alert>
      </Snackbar>

      {/* Modals */}
      <ImageGenModal open={modalOpen} onClose={() => setModalOpen(false)} prompt={currentPrompt} onPasteImage={handleGenFinish} />
      <MangaViewer open={viewerOpen} onClose={() => setViewerOpen(false)} project={project} getAssetUrl={getAssetUrl} />
      
      {/* Directors Wizard */}
      {wizardTargetIndex !== null && (
        <DirectorsWizard 
          open={wizardOpen} 
          onClose={() => setWizardOpen(false)} 
          project={project} 
          targetIndex={wizardTargetIndex}
          onConfirm={handleWizardConfirm}
        />
      )}

      {/* Image Export Modal */}
      <Dialog open={imgExportOpen} onClose={() => setImgExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon color="info" /> 画像エクスポート設定
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>アスペクト比</FormLabel>
              <ToggleButtonGroup
                value={exportRatio}
                exclusive
                onChange={(_, v) => v && setExportRatio(v)}
                fullWidth
                size="small"
                color="info"
              >
                <ToggleButton value="9:16"><CropPortraitIcon sx={{ mr: 1 }}/> 9:16 (TikTok)</ToggleButton>
                <ToggleButton value="16:9"><CropLandscapeIcon sx={{ mr: 1 }}/> 16:9 (YouTube)</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider />
            <FormControl fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>コンテンツ</FormLabel>
              <FormControlLabel
                control={<Switch checked={exportWithText} onChange={e => setExportWithText(e.target.checked)} />}
                label={exportWithText ? "テロップあり" : "画像のみ"}
              />
            </FormControl>
            <Divider />
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>出力形式</FormLabel>
              <RadioGroup row value={exportMode} onChange={e => setExportMode(e.target.value as any)}>
                <FormControlLabel value="zip" control={<Radio />} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><FolderZipIcon fontSize="small"/> ZIP</Box>} />
                <FormControlLabel value="single" control={<Radio />} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><InsertPhotoIcon fontSize="small"/> 表紙のみ</Box>} />
              </RadioGroup>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setImgExportOpen(false)} color="inherit">キャンセル</Button>
          <Button onClick={handleImageExport} variant="contained" color="info" startIcon={<DownloadIcon />}>
            ダウンロード
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default StoryEditor;
"""

for filepath, content in files_content.items():
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Fixed: {filepath}")

print("\\nFix complete.")