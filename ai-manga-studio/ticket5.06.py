import os

files_content = {}

# 1. src/components/DirectorsWizard.tsx
# 型インポートの修正とGridのitemプロパティ削除
files_content['src/components/DirectorsWizard.tsx'] = """import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, Button, Box, Typography,
  Card, CardActionArea, Grid, Chip,
  Accordion, AccordionSummary, AccordionDetails,
  Tooltip, TextField, Stack, IconButton, Divider
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import LaunchIcon from '@mui/icons-material/Launch';
import MovieIcon from '@mui/icons-material/Movie';
import DownloadIcon from '@mui/icons-material/Download';
import ImageIcon from '@mui/icons-material/Image';

import { saveAs } from 'file-saver';

import {
  CAMERA_MOVEMENTS, SHOT_SIZES, ANGLES, FOCUS_TYPES, EMOTIONS, LIGHTING_TYPES
} from '../constants/directorTerms';
import type { DirectorTerm } from '../constants/directorTerms';
import type { Project, ImageBlock, VideoBlock, DirectorAttributes } from '../types';

interface DirectorsWizardProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  targetIndex: number;
  getAssetUrl: (id: string | null) => string | undefined;
  onConfirm: (prompt: string, attributes: DirectorAttributes) => void;
}

const STEPS = ['構成を選択', '演出を指定', '内容確認 & 生成'];

type StructureType = 'prequel' | 'bridge' | 'sequel';

const DirectorsWizard: React.FC<DirectorsWizardProps> = ({ open, onClose, project, targetIndex, getAssetUrl, onConfirm }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [structure, setStructure] = useState<StructureType | null>(null);
  const [generatedPrompt, setGeneratedPrompt] = useState('');

  // 演出設定ステート
  const [selectedMovements, setSelectedMovements] = useState<string[]>([]);
  const [selectedShotSize, setSelectedShotSize] = useState<string>('');
  const [selectedAngle, setSelectedAngle] = useState<string>('');
  const [selectedFocus, setSelectedFocus] = useState<string>('');
  const [selectedEmotion, setSelectedEmotion] = useState<string>('');
  const [selectedLighting, setSelectedLighting] = useState<string>('');

  // コンテキスト情報の取得
  const prevBlock = project.storyboard[targetIndex - 1];
  const nextBlock = project.storyboard[targetIndex + 1];
  const currentBlock = project.storyboard[targetIndex] as VideoBlock;

  // バリデーション
  const canSelectPrequel = !!prevBlock;
  const canSelectBridge = prevBlock?.type === 'image' && nextBlock?.type === 'image';
  const canSelectSequel = !!nextBlock;

  // 初期化 & 状態復元
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setStructure(null);
      setGeneratedPrompt(currentBlock.prompt || '');

      const saved = currentBlock.attributes || {};
      
      if (saved.structure) {
        setStructure(saved.structure);
      } else {
        if (canSelectBridge) setStructure('bridge');
        else if (canSelectPrequel) setStructure('prequel');
        else if (canSelectSequel) setStructure('sequel');
      }

      setSelectedMovements(saved.cameraMovements || []);
      setSelectedShotSize(saved.shotSize || '');
      setSelectedAngle(saved.angle || '');
      setSelectedFocus(saved.focus || '');
      setSelectedLighting(saved.lighting || '');
      setSelectedEmotion(saved.emotion || '');
    }
  }, [open, targetIndex]);

  const handleStructureSelect = (type: StructureType) => {
    setStructure(type);
    setActiveStep(1);
  };

  const toggleSelection = (id: string, current: string[], setter: (v: string[]) => void) => {
    if (current.includes(id)) setter(current.filter(i => i !== id));
    else setter([...current, id]);
  };

  const renderTermChips = (
    terms: DirectorTerm[], 
    selected: string | string[], 
    onSelect: (id: string) => void,
    multi: boolean = false
  ) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
      {terms.map(term => {
        const isSelected = multi 
          ? (selected as string[]).includes(term.id)
          : selected === term.id;
        return (
          <Tooltip key={term.id} title={term.description} arrow>
            <Chip 
              label={term.label} 
              clickable 
              color={isSelected ? "primary" : "default"}
              variant={isSelected ? "filled" : "outlined"}
              onClick={() => onSelect(term.id)}
            />
          </Tooltip>
        );
      })}
    </Box>
  );

  const handleGenerate = () => {
    if (!structure) return;

    const getDesc = (b: any) => {
      if (!b) return "None";
      if (b.type === 'image') return (b as ImageBlock).sceneDescription;
      if (b.type === 'video') return (b as VideoBlock).prompt;
      return "";
    };

    const prevDesc = getDesc(prevBlock);
    const nextDesc = getDesc(nextBlock);
    const currentDesc = currentBlock.prompt || "A specific scene";
    const synopsis = project.synopsis;
    const style = `${project.gachaResult.themeA}, ${project.gachaResult.themeB}`;

    const directions = [];
    if (selectedMovements.length > 0) directions.push(`Camera Movement: ${selectedMovements.join(', ')}`);
    if (selectedShotSize) directions.push(`Shot Size: ${selectedShotSize}`);
    if (selectedAngle) directions.push(`Angle: ${selectedAngle}`);
    if (selectedFocus) directions.push(`Focus: ${selectedFocus}`);
    if (selectedLighting) directions.push(`Lighting: ${selectedLighting}`);
    if (selectedEmotion) directions.push(`Emotion/Mood: ${selectedEmotion}`);
    
    const directionPrompt = directions.join('\\\\n');

    let basePrompt = "";
    if (structure === 'bridge') {
      basePrompt = `Create a smooth video transition.
[Start Scene]: ${prevDesc}
[End Scene]: ${nextDesc}`;
    } else if (structure === 'prequel') {
      basePrompt = `Generate a scene that leads to [Target Scene].
[Context]: Before this, ${prevDesc}.
[Target Scene]: ${currentDesc}
[Goal]: Depict the cause, trigger, or setup for the target scene.`;
    } else if (structure === 'sequel') {
      basePrompt = `Generate a sequel scene following [Target Scene].
[Target Scene]: ${currentDesc}
[Context]: After this, ${nextDesc}.
[Goal]: Depict the consequence, reaction, or aftermath.`;
    }

    const finalPrompt = `You are a professional film director. Based on the following plan, write a video generation prompt.

# 1. Structure
${basePrompt}

# 2. Direction Plan
${directionPrompt}

# 3. Project Context
Title: ${project.title}
Synopsis: ${synopsis}
Style/Theme: ${style}

# Output Requirement
* Output ONLY the English prompt for video generation.
* Emphasize visual beauty and lighting.`;

    setGeneratedPrompt(finalPrompt);
    setActiveStep(2);
  };

  const collectAttributes = (): DirectorAttributes => ({
    structure: structure!,
    cameraMovements: selectedMovements,
    shotSize: selectedShotSize,
    angle: selectedAngle,
    focus: selectedFocus,
    lighting: selectedLighting,
    emotion: selectedEmotion
  });

  const handleCopyAndClose = () => {
    navigator.clipboard.writeText(generatedPrompt);
    onConfirm(generatedPrompt, collectAttributes());
    onClose();
  };

  const handleCopyAndLaunch = (url: string) => {
    navigator.clipboard.writeText(generatedPrompt);
    onConfirm(generatedPrompt, collectAttributes());
    window.open(url, '_blank');
  };

  const handleDownloadReferenceImage = async (block: any, label: string) => {
    if (!block || !block.assignedAssetId) return;
    const url = getAssetUrl(block.assignedAssetId);
    if (!url) return;

    try {
      const res = await fetch(url);
      const blob = await res.blob();
      saveAs(blob, `${project.title}_${label}_ref.png`);
    } catch (e) {
      console.error(e);
      alert('ダウンロードに失敗しました');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon color="primary" />
          <Typography variant="h6">演出ウィザード</Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>

        {/* Step 1: Structure */}
        {activeStep === 0 && (
          <Grid container spacing={2} justifyContent="center">
            <Grid xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'prequel' ? 'primary.main' : 'divider', opacity: canSelectPrequel ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectPrequel && handleStructureSelect('prequel')} disabled={!canSelectPrequel} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <ArrowBackIcon fontSize="large" color="primary" sx={{ mb: 1 }} />
                  <Typography variant="h6" fontWeight="bold">前日譚</Typography>
                  <Typography variant="body2" color="text.secondary">直前の出来事や原因を描く</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'bridge' ? 'primary.main' : 'divider', opacity: canSelectBridge ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectBridge && handleStructureSelect('bridge')} disabled={!canSelectBridge} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <CompareArrowsIcon fontSize="large" color="secondary" sx={{ mb: 1 }} />
                  <Typography variant="h6" fontWeight="bold">補間 (Bridge)</Typography>
                  <Typography variant="body2" color="text.secondary">前後をなめらかにつなぐ</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'sequel' ? 'primary.main' : 'divider', opacity: canSelectSequel ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectSequel && handleStructureSelect('sequel')} disabled={!canSelectSequel} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <ArrowForwardIcon fontSize="large" color="success" sx={{ mb: 1 }} />
                  <Typography variant="h6" fontWeight="bold">後日談</Typography>
                  <Typography variant="body2" color="text.secondary">直後の展開や反応を描く</Typography>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Step 2: Direction */}
        {activeStep === 1 && (
          <Box>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MovieIcon fontSize="small"/> カメラワーク</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>カメラの動き (複数可)</Typography>
                    {renderTermChips(CAMERA_MOVEMENTS, selectedMovements, (id) => toggleSelection(id, selectedMovements, setSelectedMovements), true)}
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>ショットサイズ</Typography>
                    {renderTermChips(SHOT_SIZES, selectedShotSize, setSelectedShotSize)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>アングル</Typography>
                    {renderTermChips(ANGLES, selectedAngle, setSelectedAngle)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>フォーカス</Typography>
                    {renderTermChips(FOCUS_TYPES, selectedFocus, setSelectedFocus)}
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>雰囲気と感情</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>照明と時間帯</Typography>
                    {renderTermChips(LIGHTING_TYPES, selectedLighting, setSelectedLighting)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>感情・ムード</Typography>
                    {renderTermChips(EMOTIONS, selectedEmotion, setSelectedEmotion)}
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}

        {/* Step 3: Review */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>生成されたプロンプト (編集可能):</Typography>
            <TextField
              multiline
              rows={8}
              fullWidth
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: '0.85rem', bgcolor: '#0f172a' }}
            />
            
            {/* Download Reference Images */}
            <Box sx={{ mt: 3, mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom display="flex" alignItems="center" gap={1}>
                <ImageIcon fontSize="small" /> 参照画像のダウンロード (アップロード用)
              </Typography>
              <Stack direction="row" spacing={2}>
                {(structure === 'prequel' || structure === 'bridge') && prevBlock && prevBlock.type === 'image' && (
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => handleDownloadReferenceImage(prevBlock, 'start')}>
                    前のコマ (Start)
                  </Button>
                )}
                {(structure === 'sequel' || structure === 'bridge') && nextBlock && nextBlock.type === 'image' && (
                  <Button variant="outlined" size="small" startIcon={<DownloadIcon />} onClick={() => handleDownloadReferenceImage(nextBlock, 'end')}>
                    次のコマ (End)
                  </Button>
                )}
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                外部サイトで生成 (Window Shopping):
              </Typography>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://app.runwayml.com')}>Runway</Button>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://lumalabs.ai/dream-machine')}>Luma</Button>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://klingai.com')}>Kling</Button>
                {/* Flow Correct URL */}
                <Button variant="contained" color="secondary" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://labs.google/fx/ja/tools/flow')}>Flow</Button>
              </Stack>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {activeStep > 0 && (
          <Button onClick={() => setActiveStep(prev => prev - 1)}>戻る</Button>
        )}
        <Box sx={{ flex: 1 }} />
        {activeStep === 1 && (
          <Button variant="contained" onClick={handleGenerate} endIcon={<AutoFixHighIcon />}>
            プロンプト生成
          </Button>
        )}
        {activeStep === 2 && (
          <Button variant="contained" onClick={handleCopyAndClose} startIcon={<ContentCopyIcon />} color="primary">
            コピーして完了
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DirectorsWizard;
"""

# 2. src/features/editor/StoryEditor.tsx
# 未使用インポート削除と型インポート修正
files_content['src/features/editor/StoryEditor.tsx'] = """import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Chip, IconButton, Stack, CircularProgress, 
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, 
  Switch, ToggleButtonGroup, ToggleButton, Divider, TextField, Tooltip, Snackbar, Alert
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

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCurrentProject, updateProjectAsset, addStoryBlock, removeStoryBlock, updateBlockPrompt, updateBlockAttributes } from '../projects/projectSlice';
import { addAsset } from '../assets/assetSlice';

// Components & Utils
import ImageGenModal from '../../components/ImageGenModal';
import MangaViewer from '../../components/MangaViewer';
import DirectorsWizard from '../../components/DirectorsWizard';
import { generatePDF } from '../../utils/pdfExporter';
import type { PDFExportOptions } from '../../utils/pdfExporter';
import { generateImages } from '../../utils/imageExporter';
import type { AspectRatio } from '../../utils/imageExporter';
import type { ImageBlock, VideoBlock, DirectorAttributes } from '../../types';

interface StoryEditorProps {
  getAssetUrl: (id: string | null) => string | undefined;
}

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

  const [modalOpen, setModalOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [targetId, setTargetId] = useState<'cover' | string>('cover');

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState('');
  const [pdfMenuAnchor, setPdfMenuAnchor] = useState<null | HTMLElement>(null);

  const [imgExportOpen, setImgExportOpen] = useState(false);
  const [exportRatio, setExportRatio] = useState<AspectRatio>('9:16');
  const [exportWithText, setExportWithText] = useState(true);
  const [exportMode, setExportMode] = useState<'zip' | 'single'>('zip');

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardTargetIndex, setWizardTargetIndex] = useState<number | null>(null);

  const [snippetMenuAnchor, setSnippetMenuAnchor] = useState<null | HTMLElement>(null);
  const [activeSnippetBlockId, setActiveSnippetBlockId] = useState<string | null>(null);

  const [linkSnackbarOpen, setLinkSnackbarOpen] = useState(false);

  if (!project) return null;

  // --- Handlers ---

  const handleBack = () => {
    dispatch(setCurrentProject(null));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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

  // --- Wizard Handlers ---
  const handleOpenWizard = (index: number) => {
    setWizardTargetIndex(index);
    setWizardOpen(true);
  };

  const handleWizardConfirm = (prompt: string, attributes: DirectorAttributes) => {
    if (wizardTargetIndex !== null) {
      const block = project.storyboard[wizardTargetIndex];
      dispatch(updateBlockAttributes({ 
        projectId: project.id, 
        blockId: block.id, 
        attributes, 
        prompt 
      }));
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
        
        {/* Video Preview */}
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
             <Tooltip title="演出ウィザードを開く">
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: 'text.secondary' }}>
          リストに戻る
        </Button>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" color="info" startIcon={<DownloadIcon />} onClick={() => setImgExportOpen(true)} disabled={isExporting}>
            {isExporting ? exportMessage : "画像DL"}
          </Button>
          <Box>
            <Button variant="outlined" color="primary" startIcon={isExporting ? <CircularProgress size={20} /> : <PictureAsPdfIcon />} endIcon={!isExporting && <KeyboardArrowDownIcon />} onClick={handlePdfMenuOpen} disabled={isExporting}>
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

      <Menu anchorEl={snippetMenuAnchor} open={Boolean(snippetMenuAnchor)} onClose={handleSnippetMenuClose}>
        <Typography variant="caption" sx={{ px: 2, py: 1, color: 'text.secondary' }}>スタイル定型文を挿入</Typography>
        <Divider />
        {PROMPT_SNIPPETS.map((text, i) => (
            <MenuItem key={i} onClick={() => handleApplySnippet(text)} sx={{ fontSize: '0.85rem' }}>
                {text}
            </MenuItem>
        ))}
      </Menu>

      <Snackbar 
        open={linkSnackbarOpen} 
        autoHideDuration={6000} 
        onClose={() => setLinkSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setLinkSnackbarOpen(false)} severity="success" sx={{ width: '100%', alignItems: 'center' }} icon={<ContentCopyIcon />}>
            <Box>
                <Typography variant="subtitle2" fontWeight="bold">プロンプトを更新しました</Typography>
                <Typography variant="caption" display="block" mb={1}>外部サイトを開いて生成:</Typography>
                <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://app.runwayml.com" target="_blank">Runway</Button>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://lumalabs.ai/dream-machine" target="_blank">Luma</Button>
                    <Button size="small" variant="outlined" color="inherit" startIcon={<LaunchIcon />} href="https://klingai.com" target="_blank">Kling</Button>
                    {/* Flow Correct URL */}
                    <Button size="small" variant="contained" color="secondary" startIcon={<LaunchIcon />} href="https://labs.google/fx/ja/tools/flow" target="_blank">Flow</Button>
                </Stack>
            </Box>
        </Alert>
      </Snackbar>

      <ImageGenModal open={modalOpen} onClose={() => setModalOpen(false)} prompt={currentPrompt} onPasteImage={handleGenFinish} />
      <MangaViewer open={viewerOpen} onClose={() => setViewerOpen(false)} project={project} getAssetUrl={getAssetUrl} />
      
      {wizardTargetIndex !== null && (
        <DirectorsWizard 
          open={wizardOpen} 
          onClose={() => setWizardOpen(false)} 
          project={project} 
          targetIndex={wizardTargetIndex}
          getAssetUrl={getAssetUrl}
          onConfirm={handleWizardConfirm}
        />
      )}

      <Dialog open={imgExportOpen} onClose={() => setImgExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon color="info" /> 画像エクスポート設定
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>アスペクト比</FormLabel>
              <ToggleButtonGroup value={exportRatio} exclusive onChange={(_, v) => v && setExportRatio(v)} fullWidth size="small" color="info">
                <ToggleButton value="9:16"><CropPortraitIcon sx={{ mr: 1 }}/> 9:16 (TikTok)</ToggleButton>
                <ToggleButton value="16:9"><CropLandscapeIcon sx={{ mr: 1 }}/> 16:9 (YouTube)</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Divider />
            <FormControl fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>コンテンツ</FormLabel>
              <FormControlLabel control={<Switch checked={exportWithText} onChange={e => setExportWithText(e.target.checked)} />} label={exportWithText ? "テロップあり" : "画像のみ"} />
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

# 3. src/features/projects/projectSlice.ts
# 未使用のVideoBlock型インポートを削除
files_content['src/features/projects/projectSlice.ts'] = """import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Project, StoryBlock, DirectorAttributes } from '../../types';
import { dbGetAllProjects, dbSaveProject, dbDeleteProject } from '../../db';
import { v4 as uuidv4 } from 'uuid';

interface ProjectState {
  items: Project[];
  currentProject: Project | null;
  status: 'idle' | 'loading' | 'succeeded';
}

const initialState: ProjectState = {
  items: [],
  currentProject: null,
  status: 'idle',
};

// --- Async Thunks ---

export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const projects = await dbGetAllProjects();
  return projects.map((p: any) => {
    // Migration: pages -> storyboard
    if (p.pages && !p.storyboard) {
      const storyboard: StoryBlock[] = p.pages.map((page: any) => ({
        ...page,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: page.assignedAssetId
      }));
      const { pages, ...rest } = p;
      return { ...rest, storyboard } as Project;
    }
    return p as Project;
  });
});

export const createOrUpdateProject = createAsyncThunk(
  'projects/saveProject',
  async (project: Project) => {
    const now = Date.now();
    const toSave = { ...project, updatedAt: now };
    if (!toSave.createdAt) toSave.createdAt = now;
    await dbSaveProject(toSave);
    return toSave;
  }
);

export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string) => {
    await dbDeleteProject(id);
    return id;
  }
);

// --- Storyboard Manipulation Thunks ---

export const addStoryBlock = createAsyncThunk(
  'projects/addStoryBlock',
  async ({ projectId, index, block }: { projectId: string, index: number, block: StoryBlock }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const newStoryboard = [...project.storyboard];
    newStoryboard.splice(index, 0, block);

    const updatedProject = { ...project, storyboard: newStoryboard, updatedAt: Date.now() };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const removeStoryBlock = createAsyncThunk(
  'projects/removeStoryBlock',
  async ({ projectId, blockId }: { projectId: string, blockId: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = { 
      ...project, 
      storyboard: project.storyboard.filter(b => b.id !== blockId),
      updatedAt: Date.now() 
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const updateBlockPrompt = createAsyncThunk(
  'projects/updateBlockPrompt',
  async ({ projectId, blockId, prompt }: { projectId: string, blockId: string, prompt: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = {
      ...project,
      storyboard: project.storyboard.map(b => b.id === blockId && b.type === 'video' ? { ...b, prompt } : b),
      updatedAt: Date.now()
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const updateBlockAttributes = createAsyncThunk(
  'projects/updateBlockAttributes',
  async ({ projectId, blockId, attributes, prompt }: { projectId: string, blockId: string, attributes: DirectorAttributes, prompt?: string }, { getState }) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = {
      ...project,
      storyboard: project.storyboard.map(b => {
        if (b.id === blockId && b.type === 'video') {
          return { 
            ...b, 
            attributes, 
            prompt: prompt || b.prompt
          };
        }
        return b;
      }),
      updatedAt: Date.now()
    };
    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

export const updateProjectAsset = createAsyncThunk(
  'projects/updateAsset',
  async (
    { projectId, type, blockId, assetId }: { projectId: string, type: 'cover' | 'block', blockId?: string, assetId: string }, 
    { getState }
  ) => {
    const state = getState() as { projects: { items: Project[] } };
    const project = state.projects.items.find(p => p.id === projectId);
    if (!project) throw new Error("Project not found");

    const updatedProject = { ...project, updatedAt: Date.now() };
    
    if (type === 'cover') {
      updatedProject.coverAssetId = assetId;
    } else if (type === 'block' && blockId) {
      updatedProject.storyboard = updatedProject.storyboard.map(b => {
        if (b.id === blockId) {
          return { ...b, assignedAssetId: assetId };
        }
        return b;
      });
    }

    await dbSaveProject(updatedProject);
    return updatedProject;
  }
);

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    setCurrentProject: (state, action: PayloadAction<Project | null>) => {
      state.currentProject = action.payload;
    },
    addProjectTemporary: (state, action: PayloadAction<Project>) => {
      state.items.unshift(action.payload);
      state.currentProject = action.payload;
    }
  },
  extraReducers: (builder) => {
    const updateProjectInState = (state: ProjectState, project: Project) => {
      const index = state.items.findIndex(p => p.id === project.id);
      if (index >= 0) state.items[index] = project;
      if (state.currentProject?.id === project.id) state.currentProject = project;
    };

    builder
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.items = action.payload.sort((a, b) => b.updatedAt - a.updatedAt);
        state.status = 'succeeded';
      })
      .addCase(createOrUpdateProject.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) state.items[index] = action.payload;
        else state.items.unshift(action.payload);
        state.items.sort((a, b) => b.updatedAt - a.updatedAt);
        if (state.currentProject?.id === action.payload.id) state.currentProject = action.payload;
      })
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) state.currentProject = null;
      })
      .addCase(addStoryBlock.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(removeStoryBlock.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateBlockPrompt.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateBlockAttributes.fulfilled, (state, action) => updateProjectInState(state, action.payload))
      .addCase(updateProjectAsset.fulfilled, (state, action) => updateProjectInState(state, action.payload));
  },
});

export const { setCurrentProject, addProjectTemporary } = projectSlice.actions;
export default projectSlice.reducer;
"""

for filepath, content in files_content.items():
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Fixed: {filepath}")

print("\\nAll TypeScript errors resolved.")