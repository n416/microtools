import os

files_content = {}

# src/components/DirectorsWizard.tsx
# handleCopyAndLaunch から onClose() を削除して、ウィンドウを開いたままにする
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
  CAMERA_MOVEMENTS, SHOT_SIZES, ANGLES, FOCUS_TYPES, EMOTIONS, LIGHTING_TYPES, DirectorTerm
} from '../constants/directorTerms';
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

  // ★修正: 外部サイトを開いてもモーダルを閉じない
  const handleCopyAndLaunch = (url: string) => {
    navigator.clipboard.writeText(generatedPrompt);
    onConfirm(generatedPrompt, collectAttributes());
    window.open(url, '_blank');
    // onClose(); // 削除: ウィザードを開いたままにする
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
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'prequel' ? 'primary.main' : 'divider', opacity: canSelectPrequel ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectPrequel && handleStructureSelect('prequel')} disabled={!canSelectPrequel} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <ArrowBackIcon fontSize="large" color="primary" sx={{ mb: 1 }} />
                  <Typography variant="h6" fontWeight="bold">前日譚</Typography>
                  <Typography variant="body2" color="text.secondary">直前の出来事や原因を描く</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ borderColor: structure === 'bridge' ? 'primary.main' : 'divider', opacity: canSelectBridge ? 1 : 0.5 }}>
                <CardActionArea onClick={() => canSelectBridge && handleStructureSelect('bridge')} disabled={!canSelectBridge} sx={{ height: '100%', p: 2, textAlign: 'center' }}>
                  <CompareArrowsIcon fontSize="large" color="secondary" sx={{ mb: 1 }} />
                  <Typography variant="h6" fontWeight="bold">補間 (Bridge)</Typography>
                  <Typography variant="body2" color="text.secondary">前後をなめらかにつなぐ</Typography>
                </CardActionArea>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
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
                {/* Flow Link */}
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

for filepath, content in files_content.items():
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Updated: {filepath}")

print("\\nCorrection: Wizard close behavior fixed.")