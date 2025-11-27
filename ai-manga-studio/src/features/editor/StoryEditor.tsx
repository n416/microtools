import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Chip, IconButton, Stack, CircularProgress, 
  Menu, MenuItem, ListItemIcon, ListItemText // 追加
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ImageIcon from '@mui/icons-material/Image';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'; // 追加
import CompressIcon from '@mui/icons-material/Compress'; // 追加 (軽量版用)
import HighQualityIcon from '@mui/icons-material/HighQuality'; // 追加 (高画質用)

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCurrentProject, updateProjectAsset } from '../projects/projectSlice';
import { addAsset } from '../assets/assetSlice';

// Components & Utils
import ImageGenModal from '../../components/ImageGenModal';
import MangaViewer from '../../components/MangaViewer';
import { generatePDF } from '../../utils/pdfExporter'; // 型定義もインポート
import { type PDFExportOptions } from '../../utils/pdfExporter'; // 型定義もインポート

interface StoryEditorProps {
  getAssetUrl: (id: string | null) => string | undefined;
}

const StoryEditor: React.FC<StoryEditorProps> = ({ getAssetUrl }) => {
  const dispatch = useAppDispatch();
  const project = useAppSelector(state => state.projects.currentProject);
  const allAssets = useAppSelector(state => state.assets.items);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [targetIndex, setTargetIndex] = useState<'cover' | number>('cover');

  // PDF Export State & Menu
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [pdfMenuAnchor, setPdfMenuAnchor] = useState<null | HTMLElement>(null); // メニュー用

  if (!project) return null;

  // --- Handlers ---

  const handleBack = () => {
    dispatch(setCurrentProject(null));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // PDF Menu Handlers
  const handlePdfMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setPdfMenuAnchor(event.currentTarget);
  };
  const handlePdfMenuClose = () => {
    setPdfMenuAnchor(null);
  };

  // PDF Export Execution
  const handleExportPDF = async (options: PDFExportOptions) => {
    handlePdfMenuClose(); // メニューを閉じる
    setIsExporting(true);
    setExportMessage("準備中...");
    
    setTimeout(async () => {
      await generatePDF(project, allAssets, (msg) => setExportMessage(msg), options);
      setIsExporting(false);
      setExportMessage('');
    }, 100);
  };

  // ... (以下 Image Gen関連ハンドラは変更なし) ...
  const handleGenStart = (prompt: string, target: 'cover' | number) => {
    const fullPrompt = `(Masterpiece, Best Quality), Manga Style. ${prompt}`;
    setCurrentPrompt(fullPrompt);
    setTargetIndex(target);
    setModalOpen(true);
  };

  const handleGenFinish = async (files: FileList) => {
    if (files.length > 0) {
      const action = await dispatch(addAsset({ file: files[0], category: 'generated' }));
      if (addAsset.fulfilled.match(action)) {
        const newAssetId = action.payload.id;
        dispatch(updateProjectAsset({
          projectId: project.id,
          type: targetIndex === 'cover' ? 'cover' : 'page',
          pageIndex: typeof targetIndex === 'number' ? targetIndex : undefined,
          assetId: newAssetId
        }));
        setModalOpen(false);
      }
    }
  };

  const handleDropAssign = async (e: React.DragEvent, target: 'cover' | number) => {
    e.preventDefault();
    const assetId = e.dataTransfer.getData('assetId');
    if (assetId) {
      dispatch(updateProjectAsset({
        projectId: project.id,
        type: target === 'cover' ? 'cover' : 'page',
        pageIndex: typeof target === 'number' ? target : undefined,
        assetId: assetId
      }));
    } else if (e.dataTransfer.files.length > 0) {
      const action = await dispatch(addAsset({ file: e.dataTransfer.files[0], category: 'material' }));
      if (addAsset.fulfilled.match(action)) {
        dispatch(updateProjectAsset({
          projectId: project.id,
          type: target === 'cover' ? 'cover' : 'page',
          pageIndex: typeof target === 'number' ? target : undefined,
          assetId: action.payload.id
        }));
      }
    }
  };

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

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 3, paddingBottom: '8rem' }}>
      
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: 'text.secondary' }}>
          リストに戻る
        </Button>
        
        <Stack direction="row" spacing={2}>
          {/* PDF Export Dropdown Button */}
          <Box>
            <Button 
              variant="outlined" 
              color="primary"
              startIcon={isExporting ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
              endIcon={!isExporting && <KeyboardArrowDownIcon />}
              onClick={handlePdfMenuOpen}
              disabled={isExporting}
            >
              {isExporting ? exportMessage : "PDF出力"}
            </Button>
            <Menu
              anchorEl={pdfMenuAnchor}
              open={Boolean(pdfMenuAnchor)}
              onClose={handlePdfMenuClose}
            >
              {/* 高画質: Scale 2, Quality 0.9 */}
              <MenuItem onClick={() => handleExportPDF({ scale: 2, quality: 0.9 })}>
                <ListItemIcon><HighQualityIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="高画質 (通常)" secondary="綺麗な印刷向け (ファイル大)" />
              </MenuItem>
              
              {/* 軽量版: Scale 1, Quality 0.6 */}
              <MenuItem onClick={() => handleExportPDF({ scale: 1, quality: 0.6, filenameSuffix: '_light' })}>
                <ListItemIcon><CompressIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="軽量版 (圧縮)" secondary="スマホ・共有向け (ファイル小)" />
              </MenuItem>
            </Menu>
          </Box>

          <Button 
            variant="contained" 
            color="success" 
            startIcon={<PlayCircleOutlineIcon />}
            onClick={() => setViewerOpen(true)}
          >
            プレビュー
          </Button>
        </Stack>
      </Box>

      {/* Cover Section */}
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
          {renderImagePlaceholder(
            project.coverAssetId, 
            () => handleGenStart(project.coverImagePrompt, 'cover'), 
            (e) => handleDropAssign(e, 'cover'),
            "表紙生成"
          )}
          <Box sx={{ flex: 1, bgcolor: 'rgba(2, 6, 23, 0.3)', p: 2, borderRadius: 1, border: 1, borderColor: 'divider' }}>
            <Typography variant="caption" fontWeight="bold" color="text.secondary" display="block" mb={1}>EDITOR'S NOTE</Typography>
            <Typography variant="body2" color="text.secondary">{project.editorNote}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Pages Section */}
      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>
        ネーム構成 (全{project.pages.length}P)
      </Typography>

      <Stack spacing={2}>
        {project.pages.map((page, idx) => (
          <Paper key={idx} variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, '&:hover': { borderColor: 'text.secondary' } }}>
            <Typography variant="h5" fontWeight="bold" color="text.disabled" sx={{ width: 40, textAlign: 'center', pt: 1 }}>
              {page.pageNumber}
            </Typography>
            
            {renderImagePlaceholder(
              page.assignedAssetId, 
              () => handleGenStart(page.imagePrompt, idx),
              (e) => handleDropAssign(e, idx),
              "画像生成"
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                {page.sceneDescription}
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: '#020617', borderLeft: 3, borderColor: 'primary.main' }}>
                <Typography variant="body2" color="primary.light">{page.dialogue}</Typography>
              </Paper>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontFamily="monospace" color="text.disabled" noWrap sx={{ maxWidth: '80%', bgcolor: 'rgba(255,255,255,0.05)', px: 1, borderRadius: 0.5 }}>
                  {page.imagePrompt}
                </Typography>
                <IconButton size="small" onClick={() => copyToClipboard(page.imagePrompt)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>

      <ImageGenModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        prompt={currentPrompt}
        onPasteImage={handleGenFinish}
      />

      <MangaViewer 
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        project={project}
        getAssetUrl={getAssetUrl}
      />
    </Box>
  );
};

export default StoryEditor;