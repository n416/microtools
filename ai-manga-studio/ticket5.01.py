import os

files_content = {}

# 1. src/constants/directorTerms.ts (新規作成)
files_content['src/constants/directorTerms.ts'] = """
export interface DirectorTerm {
  id: string;
  label: string;
  description: string;
}

// 🎥 Camera Work: Movement
export const CAMERA_MOVEMENTS: DirectorTerm[] = [
  { 
    id: 'FIX', 
    label: 'FIX (固定)', 
    description: 'カメラを固定して撮影する手法。被写体を動かさずにその場で撮影する。' 
  },
  { 
    id: 'ZOOM_IN', 
    label: 'ZOOM IN', 
    description: 'レンズの焦点を変えて被写体に近づく（心理的な注目・緊張感）。' 
  },
  { 
    id: 'ZOOM_OUT', 
    label: 'ZOOM OUT', 
    description: 'レンズの焦点を変えて被写体から離れる（状況説明・開放感）。' 
  },
  { 
    id: 'PAN', 
    label: 'PAN (左右)', 
    description: 'カメラを水平（左右）に振る技法。視線の移動や広がりを表現。' 
  },
  { 
    id: 'TILT', 
    label: 'TILT (上下)', 
    description: 'カメラを垂直（上下）に振る技法。高さや被写体の全身を表現。' 
  },
  { 
    id: 'DOLLY_IN', 
    label: 'DOLLY IN', 
    description: '台車等でカメラごと被写体に近づく。背景の遠近感が変化し、没入感を生む。' 
  },
  { 
    id: 'DOLLY_OUT', 
    label: 'DOLLY OUT', 
    description: '台車等でカメラごと被写体から遠ざかる。孤立感や終焉を演出。' 
  },
  { 
    id: 'TRACKING', 
    label: 'TRACKING (追尾)', 
    description: '被写体の動きに合わせて並行移動する。歩行シーンなどで多用される。' 
  },
  { 
    id: 'ARC', 
    label: 'ARC (回り込み)', 
    description: '被写体の周囲を円を描くように回り込む。状況の劇的な変化や混乱を表現。' 
  },
  { 
    id: 'CRANE', 
    label: 'CRANE', 
    description: '高い位置から低い位置へ（またはその逆に）大きく移動させるダイナミックな撮影。' 
  },
  { 
    id: 'HANDHELD', 
    label: 'HANDHELD', 
    description: '手持ち撮影。手ブレによるリアリティや臨場感、不安定な心情を強調。' 
  },
  { 
    id: 'STEADICAM', 
    label: 'STEADICAM', 
    description: '手持ちだが揺れを抑え、滑らかに移動する。浮遊感のある長回しなどに適する。' 
  },
];

// 🎥 Camera Work: Shot Size
export const SHOT_SIZES: DirectorTerm[] = [
  { 
    id: 'EXTREME_CLOSE_UP', 
    label: 'Extreme Close-Up', 
    description: '目元や指先など細部の強調。強い感情や重要な手がかりを示す。' 
  },
  { 
    id: 'CLOSE_UP', 
    label: 'Close-Up', 
    description: '顔や小物を画面いっぱいに映す。キャラクターの感情を明確に伝える。' 
  },
  { 
    id: 'MEDIUM_SHOT', 
    label: 'Medium Shot', 
    description: '腰から上。人物の表情とアクション、周囲の環境をバランスよく捉える。' 
  },
  { 
    id: 'WIDE_SHOT', 
    label: 'Wide Shot', 
    description: '全身や風景。位置関係や状況全体を説明する際に使用。' 
  },
];

// 🎥 Camera Work: Angle & Composition
export const ANGLES: DirectorTerm[] = [
  { 
    id: 'EYE_LEVEL', 
    label: 'Eye Level', 
    description: '通常の視点。客観的でフラットな印象を与える。' 
  },
  { 
    id: 'LOW_ANGLE', 
    label: 'Low Angle', 
    description: '下から見上げる。被写体の威厳、力強さ、あるいは恐怖感を強調する。' 
  },
  { 
    id: 'HIGH_ANGLE', 
    label: 'High Angle', 
    description: '上から見下ろす。被写体の弱さ、孤独、あるいは状況の俯瞰を表す。' 
  },
  { 
    id: 'OVER_THE_SHOULDER', 
    label: 'Over The Shoulder', 
    description: '一方の肩越しにもう一方を撮影する。対話シーンの基本アングル。' 
  },
  { 
    id: 'POV', 
    label: 'POV (主観)', 
    description: '被写体の視点から見た映像。キャラクター体験への強い没入感を生む。' 
  },
];

// 🎥 Camera Work: Focus
export const FOCUS_TYPES: DirectorTerm[] = [
  { 
    id: 'RACK_FOCUS', 
    label: 'Rack Focus', 
    description: '撮影中にピント位置を変える。視線をAからBへ意図的に誘導する。' 
  },
  { 
    id: 'DEEP_FOCUS', 
    label: 'Deep Focus', 
    description: '手前から奥まで全ての要素にピントを合わせる。画面全体の情報を等価に見せる。' 
  },
  {
    id: 'SHALLOW_FOCUS',
    label: 'Shallow Focus',
    description: '背景をぼかし、被写体だけを強調する（ボケ味）。'
  }
];

// 🎭 Acting & Emotion
export const EMOTIONS: DirectorTerm[] = [
  { id: 'Happy', label: 'Happy/Joy', description: '笑顔、喜び、明るい雰囲気' },
  { id: 'Sad', label: 'Sad/Crying', description: '悲しみ、涙、憂鬱' },
  { id: 'Angry', label: 'Angry', description: '怒り、激昂、敵意' },
  { id: 'Surprised', label: 'Surprised', description: '驚き、衝撃' },
  { id: 'Scared', label: 'Scared/Fear', description: '恐怖、怯え' },
  { id: 'Serious', label: 'Serious', description: '真剣、シリアス' },
];

// ⏰ Time & Atmosphere
export const LIGHTING_TYPES: DirectorTerm[] = [
  { id: 'Natural', label: 'Natural Light', description: '自然光。リアリティのある日常的な光。' },
  { id: 'Cinematic', label: 'Cinematic', description: '映画的でドラマチックな陰影のある照明。' },
  { id: 'GoldenHour', label: 'Golden Hour', description: '夕暮れや夜明けの温かく美しい光。' },
  { id: 'Neon', label: 'Neon/Cyberpunk', description: 'ネオンサインなど人工的な光。近未来的。' },
  { id: 'Dark', label: 'Dark/Horror', description: '暗闇、ローキー照明。恐怖や不安を煽る。' },
];
"""

# 2. src/components/DirectorsWizard.tsx (新規作成)
files_content['src/components/DirectorsWizard.tsx'] = """import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stepper, Step, StepLabel, Button, Box, Typography,
  Card, CardActionArea, CardContent, Grid, Chip,
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

import {
  CAMERA_MOVEMENTS, SHOT_SIZES, ANGLES, FOCUS_TYPES, EMOTIONS, LIGHTING_TYPES, DirectorTerm
} from '../constants/directorTerms';
import type { Project, ImageBlock, VideoBlock } from '../types';

interface DirectorsWizardProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  targetIndex: number;
  onConfirm: (prompt: string) => void;
}

// ステップ定義
const STEPS = ['Structure (構造)', 'Direction (演出)', 'Review (生成)'];

type StructureType = 'prequel' | 'bridge' | 'sequel';

const DirectorsWizard: React.FC<DirectorsWizardProps> = ({ open, onClose, project, targetIndex, onConfirm }) => {
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

  // リセット
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setStructure(null);
      setGeneratedPrompt('');
      // デフォルト値
      if (canSelectBridge) setStructure('bridge');
      else if (canSelectPrequel) setStructure('prequel');
      else if (canSelectSequel) setStructure('sequel');
    }
  }, [open, targetIndex]);

  // Step 1: Structure 選択ロジック
  const handleStructureSelect = (type: StructureType) => {
    setStructure(type);
    setActiveStep(1);
  };

  // Step 2: 演出選択ヘルパー
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

  // Step 3: プロンプト生成
  const handleGenerate = () => {
    if (!structure) return;

    // 文脈情報の抽出
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

    // 演出情報の結合
    const directions = [];
    if (selectedMovements.length > 0) directions.push(`Camera Movement: ${selectedMovements.join(', ')}`);
    if (selectedShotSize) directions.push(`Shot Size: ${selectedShotSize}`);
    if (selectedAngle) directions.push(`Angle: ${selectedAngle}`);
    if (selectedFocus) directions.push(`Focus: ${selectedFocus}`);
    if (selectedLighting) directions.push(`Lighting: ${selectedLighting}`);
    if (selectedEmotion) directions.push(`Emotion/Mood: ${selectedEmotion}`);
    
    const directionPrompt = directions.join('\\n');

    // 構造別テンプレート
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

  const handleCopyAndClose = () => {
    navigator.clipboard.writeText(generatedPrompt);
    onConfirm(generatedPrompt);
    onClose();
  };

  const handleCopyAndLaunch = (url: string) => {
    navigator.clipboard.writeText(generatedPrompt);
    onConfirm(generatedPrompt);
    window.open(url, '_blank');
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon color="primary" />
          <Typography variant="h6">Director's Wizard</Typography>
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
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'prequel' ? 'primary.main' : 'divider', opacity: canSelectPrequel ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectPrequel && handleStructureSelect('prequel')} disabled={!canSelectPrequel} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <ArrowBackIcon fontSize="large" color="primary" sx={{ mb: 1 }} />
                  <Typography variant="h6">Prequel (前日譚)</Typography>
                  <Typography variant="body2" color="text.secondary">直前の出来事や原因を描く</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'bridge' ? 'primary.main' : 'divider', opacity: canSelectBridge ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectBridge && handleStructureSelect('bridge')} disabled={!canSelectBridge} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <CompareArrowsIcon fontSize="large" color="secondary" sx={{ mb: 1 }} />
                  <Typography variant="h6">Bridge (補間)</Typography>
                  <Typography variant="body2" color="text.secondary">前後をなめらかにつなぐ</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'sequel' ? 'primary.main' : 'divider', opacity: canSelectSequel ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectSequel && handleStructureSelect('sequel')} disabled={!canSelectSequel} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <ArrowForwardIcon fontSize="large" color="success" sx={{ mb: 1 }} />
                  <Typography variant="h6">Sequel (後日談)</Typography>
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
                <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><MovieIcon fontSize="small"/> Camera Work</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Movement (複数可)</Typography>
                    {renderTermChips(CAMERA_MOVEMENTS, selectedMovements, (id) => toggleSelection(id, selectedMovements, setSelectedMovements), true)}
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Shot Size</Typography>
                    {renderTermChips(SHOT_SIZES, selectedShotSize, setSelectedShotSize)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Angle</Typography>
                    {renderTermChips(ANGLES, selectedAngle, setSelectedAngle)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Focus</Typography>
                    {renderTermChips(FOCUS_TYPES, selectedFocus, setSelectedFocus)}
                  </Box>
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Atmosphere & Emotion</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Lighting & Time</Typography>
                    {renderTermChips(LIGHTING_TYPES, selectedLighting, setSelectedLighting)}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" gutterBottom>Emotion</Typography>
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
            <Typography variant="subtitle2" gutterBottom>Generated Prompt (Editable):</Typography>
            <TextField
              multiline
              rows={10}
              fullWidth
              value={generatedPrompt}
              onChange={(e) => setGeneratedPrompt(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: '0.85rem', bgcolor: '#0f172a' }}
            />
            
            <Box sx={{ mt: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Window Shopping (外部サイトで生成):
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://app.runwayml.com')}>Runway</Button>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://lumalabs.ai/dream-machine')}>Luma</Button>
                <Button variant="outlined" startIcon={<LaunchIcon />} onClick={() => handleCopyAndLaunch('https://klingai.com')}>Kling</Button>
              </Stack>
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        {activeStep > 0 && (
          <Button onClick={() => setActiveStep(prev => prev - 1)}>Back</Button>
        )}
        <Box sx={{ flex: 1 }} />
        {activeStep === 1 && (
          <Button variant="contained" onClick={handleGenerate} endIcon={<AutoFixHighIcon />}>
            Generate Prompt
          </Button>
        )}
        {activeStep === 2 && (
          <Button variant="contained" onClick={handleCopyAndClose} startIcon={<ContentCopyIcon />} color="secondary">
            Copy & Close
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default DirectorsWizard;
"""

# 3. src/features/editor/StoryEditor.tsx (修正)
# Menuロジックを廃止し、DirectorsWizardの呼び出しに置換
files_content['src/features/editor/StoryEditor.tsx'] = """import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Chip, IconButton, Stack, CircularProgress, 
  Menu, MenuItem, Dialog, DialogTitle, DialogContent, 
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
import { setCurrentProject, updateProjectAsset, addStoryBlock, removeStoryBlock, updateBlockPrompt } from '../projects/projectSlice';
import { addAsset } from '../assets/assetSlice';

// Components & Utils
import ImageGenModal from '../../components/ImageGenModal';
import MangaViewer from '../../components/MangaViewer';
import DirectorsWizard from '../../components/DirectorsWizard'; // ★New
import { generatePDF } from '../../utils/pdfExporter';
import type { PDFExportOptions } from '../../utils/pdfExporter';
import { generateImages } from '../../utils/imageExporter';
import type { AspectRatio } from '../../utils/imageExporter';
import { ImageBlock, VideoBlock } from '../../types';

interface StoryEditorProps {
  getAssetUrl: (id: string | null) => string | undefined;
}

// 定型文リスト (Ticket #4)
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
      setLinkSnackbarOpen(true); // Show launcher toast
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
      
      {/* Header Bar (Same) */}
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

      {/* Main Editor Content (Same) */}
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

      {/* Image Export Modal (略) */}
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
        print(f"Updated: {filepath}")

print("\\nTicket #5: Director's Wizard Implementation complete.")