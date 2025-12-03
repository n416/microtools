import os

# 各ファイルの新しいコンテンツを定義
files_content = {}

# 1. src/types.ts
files_content['src/types.ts'] = """export interface GachaResult {
  themeA: string;
  themeB: string;
  secretIngredient: string;
}

export interface ImageBlock {
  id: string;
  type: 'image';
  pageNumber: number;
  sceneDescription: string;
  dialogue: string;
  imagePrompt: string;
  assignedAssetId: string | null; // 画像ID
}

export type StoryBlock = ImageBlock;

export interface Project {
  id: string;
  title: string;
  coverImagePrompt: string;
  coverAssetId: string | null;
  gachaResult: GachaResult;
  synopsis: string;
  storyboard: StoryBlock[];
  editorNote: string;
  createdAt: number;
  updatedAt: number;
}

export type AssetCategory = 'material' | 'generated';

export interface Asset {
  id: string;
  url: string; // ReduxではBlobではなくURL文字列を保持
  category: AssetCategory;
  createdAt: number;
}

// DB保存用の型（ReduxにはBlobを入れられないため分離）
export interface AssetDBItem {
  id: string;
  blob: Blob;
  category: AssetCategory;
  created: number;
}
"""

# 2. src/features/projects/projectSlice.ts
files_content['src/features/projects/projectSlice.ts'] = """import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { Project, StoryBlock } from '../../types';
import { dbGetAllProjects, dbSaveProject, dbDeleteProject } from '../../db';
import { v4 as uuidv4 } from 'uuid';

// --- State Definition ---
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

// 1. 全プロジェクト取得 (マイグレーション機能付き)
export const fetchProjects = createAsyncThunk('projects/fetchProjects', async () => {
  const projects = await dbGetAllProjects();
  
  // 旧データ (pages) を新データ (storyboard) にマイグレーション
  return projects.map((p: any) => {
    if (p.pages && !p.storyboard) {
      const storyboard: StoryBlock[] = p.pages.map((page: any) => ({
        ...page,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: page.assignedAssetId
      }));
      
      // 不要になったpagesを削除してProject型にキャスト
      const { pages, ...rest } = p;
      return {
        ...rest,
        storyboard
      } as Project;
    }
    return p as Project;
  });
});

// 2. プロジェクトの新規作成または更新
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

// 3. プロジェクト削除
export const deleteProject = createAsyncThunk(
  'projects/deleteProject',
  async (id: string) => {
    await dbDeleteProject(id);
    return id;
  }
);

// 4. プロジェクト内の画像割り当て更新 (Block ID対応)
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

// --- Slice ---
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
    builder
      // Fetch
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.items = action.payload.sort((a, b) => b.updatedAt - a.updatedAt);
        state.status = 'succeeded';
      })
      // Save / Update
      .addCase(createOrUpdateProject.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        } else {
          state.items.unshift(action.payload);
        }
        state.items.sort((a, b) => b.updatedAt - a.updatedAt);
        
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      })
      // Delete
      .addCase(deleteProject.fulfilled, (state, action) => {
        state.items = state.items.filter(p => p.id !== action.payload);
        if (state.currentProject?.id === action.payload) {
          state.currentProject = null;
        }
      })
      // Asset Update
      .addCase(updateProjectAsset.fulfilled, (state, action) => {
        const index = state.items.findIndex(p => p.id === action.payload.id);
        if (index >= 0) {
          state.items[index] = action.payload;
        }
        if (state.currentProject?.id === action.payload.id) {
          state.currentProject = action.payload;
        }
      });
  },
});

export const { setCurrentProject, addProjectTemporary } = projectSlice.actions;
export default projectSlice.reducer;
"""

# 3. src/features/projects/ProjectList.tsx
files_content['src/features/projects/ProjectList.tsx'] = """import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, Card, CardContent, TextField, Button, Chip, IconButton, 
  List, ListItemButton, ListItemText, Divider, Stack, Menu, MenuItem, ListItemIcon
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import FolderIcon from '@mui/icons-material/Folder';

// Libs
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchProjects, createOrUpdateProject, setCurrentProject, deleteProject } from './projectSlice';
import type { Project, StoryBlock } from '../../types';

// Components
import StoryGenModal from '../../components/StoryGenModal';
import { exportProjectToZip, importProjectFromZip } from '../../utils/projectIO';

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector(state => state.projects);
  const assets = useAppSelector(state => state.assets.items);

  const [genres, setGenres] = useState<string[]>(['サイバーパンク', '日常']);
  const [newGenre, setNewGenre] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchProjects());
    }
  }, [status, dispatch]);

  const handleAddGenre = () => {
    if (newGenre.trim()) {
      setGenres([...genres, newGenre.trim()]);
      setNewGenre('');
    }
  };
  const handleDeleteGenre = (index: number) => {
    setGenres(genres.filter((_, i) => i !== index));
  };

  const handleCreateStory = () => {
    const prompt = `あなたは「予想外の展開」を得意とする超一流の漫画原作者であり、同時に優秀なAI漫画画像プロンプターです。
ユーザーから提供される「${genres.join('と')}」をもとに、24ページの読み切り漫画の企画、ネーム構成、そして表紙イラストを作成します。

以下のプロセスを順番に実行し、必ず画像プロンプトの生成を行ってください。

### Process (Chain)
1. **アイデアの化学反応 (Gacha Logic):**
   * 提供されたテーマを極端に解釈し、ランダムな「隠し味のジャンル」を1つ追加して独自の設定を作る。
   * **この段階で、表紙イラストの具体的な構図を決定する。**
2. **24ページの構成設計:**
   * P1-4(起), P5-12(承), P13-19(転), P20-24(結)。

### 出力形式 (JSONのみ)
\`\`\`json
{
  "coverImagePrompt": "表紙イラスト生成用プロンプト (英語)",
  "title": "タイトル (日本語)",
  "gachaResult": { "themeA": "テーマA", "themeB": "テーマB", "secretIngredient": "隠し味" },
  "synopsis": "3行あらすじ (日本語)",
  "pages": [
    { "pageNumber": 1, "sceneDescription": "シーン詳細(日)", "dialogue": "セリフ(日)", "imagePrompt": "画像プロンプト(英)" },
    ...
  ],
  "editorNote": "原作者コメント(日)"
}
\`\`\``;
    setCurrentPrompt(prompt);
    setModalOpen(true);
  };

  const handleImportFromModal = async (jsonStr: string) => {
    try {
      let clean = jsonStr.trim().replace(/```json/g, '').replace(/```/g, '');
      const s = clean.indexOf('{');
      const e = clean.lastIndexOf('}');
      if (s > -1 && e > -1) clean = clean.substring(s, e + 1);
      
      const data = JSON.parse(clean);
      if (!data.pages) throw new Error("ページデータがありません");

      // pages -> storyboard (ImageBlock) への変換
      const storyboard: StoryBlock[] = data.pages.map((p: any) => ({
        ...p,
        id: uuidv4(),
        type: 'image',
        assignedAssetId: null
      }));

      const newProject: Project = {
        id: uuidv4(),
        title: data.title,
        coverImagePrompt: data.coverImagePrompt,
        coverAssetId: null,
        gachaResult: data.gachaResult,
        synopsis: data.synopsis,
        storyboard: storyboard, // 新構造
        editorNote: data.editorNote,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await dispatch(createOrUpdateProject(newProject));
      dispatch(setCurrentProject(newProject));
      setModalOpen(false);
    } catch (e: any) {
      alert('JSON読み込みエラー: ' + e.message);
    }
  };

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, pid: string) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setSelectedProjectId(pid);
  };
  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProjectId(null);
  };

  const handleDeleteProject = () => {
    if (selectedProjectId && window.confirm('プロジェクトを削除しますか？（元に戻せません）')) {
      dispatch(deleteProject(selectedProjectId));
    }
    handleMenuClose();
  };

  const handleExportZIP = async () => {
    if (selectedProjectId) {
      const project = items.find(p => p.id === selectedProjectId);
      if (project) {
        handleMenuClose();
        try {
          await exportProjectToZip(project, assets);
        } catch (e) {
          console.error(e);
          alert('エクスポートに失敗しました');
        }
      }
    }
  };

  const handleExportJSON = () => {
    if (selectedProjectId) {
      const project = items.find(p => p.id === selectedProjectId);
      if (project) {
        const jsonStr = JSON.stringify(project, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        saveAs(blob, `${project.title || 'project'}.json`);
      }
    }
    handleMenuClose();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const newProject = await importProjectFromZip(file, dispatch);
      alert(`「${newProject.title}」をインポートしました`);
    } catch (err: any) {
      console.error(err);
      alert('インポート失敗: ' + err.message);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectProject = (project: Project) => {
    dispatch(setCurrentProject(project));
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight="bold" color="text.secondary">新規プロジェクト</Typography>
        <Button 
          variant="text" 
          startIcon={<FolderZipIcon />} 
          onClick={handleFileClick}
          size="small"
        >
          プロジェクト読込 (ZIP)
        </Button>
        <input 
          type="file" 
          ref={fileInputRef} 
          hidden 
          accept=".zip"
          onChange={handleFileChange} 
          aria-label="ZIPファイルをインポート"
        />
      </Box>

      <Card variant="outlined" sx={{ mb: 4, bgcolor: 'background.paper', borderRadius: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'primary.main', fontWeight: 'bold' }}>
            AI原作者（ガチャ）の設定
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {genres.map((g, i) => (
              <Chip key={i} label={g} onDelete={() => handleDeleteGenre(i)} size="small" />
            ))}
          </Stack>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField 
              size="small" 
              placeholder="ジャンルを追加 (例: ホラー, 学園)" 
              value={newGenre} 
              onChange={e => setNewGenre(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddGenre()}
              fullWidth
            />
            <Button variant="outlined" onClick={handleAddGenre} startIcon={<AddIcon />}>
              追加
            </Button>
          </Box>

          <Button 
            variant="contained" 
            fullWidth 
            size="large" 
            startIcon={<PlayArrowIcon />} 
            onClick={handleCreateStory}
            sx={{ fontWeight: 'bold', py: 1.5 }}
          >
            物語を生成する
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 4 }} />

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
        <FolderIcon /> プロジェクトリスト
      </Typography>
      
      {items.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled', border: '1px dashed #444', borderRadius: 2 }}>
          <Typography>プロジェクトがありません</Typography>
        </Box>
      ) : (
        <List sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {items.map(p => (
            <Card 
              key={p.id} 
              variant="outlined" 
              sx={{ 
                position: 'relative',
                borderRadius: 2,
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main' } 
              }}
            >
              <ListItemButton 
                onClick={() => handleSelectProject(p)} 
                sx={{ display: 'block', pr: 6 }} 
              >
                <ListItemText 
                  primary={
                    <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 0.5 }}>
                      {p.title}
                    </Typography>
                  }
                  secondary={
                    <Stack spacing={0.5}>
                      <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.85rem' }}>
                        {p.synopsis}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={p.gachaResult.secretIngredient} size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 20 }} />
                        <Typography variant="caption" color="text.disabled">
                          更新: {new Date(p.updatedAt).toLocaleDateString()}
                        </Typography>
                      </Stack>
                    </Stack>
                  }
                />
              </ListItemButton>

              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                <IconButton onClick={(e) => handleMenuOpen(e, p.id)} size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          ))}
        </List>
      )}

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleExportZIP}>
          <ListItemIcon><FolderZipIcon fontSize="small" /></ListItemIcon>
          <ListItemText>ZIPエクスポート</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleExportJSON}>
          <ListItemIcon><FileDownloadIcon fontSize="small" /></ListItemIcon>
          <ListItemText>JSONエクスポート</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDeleteProject} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>削除</ListItemText>
        </MenuItem>
      </Menu>

      <StoryGenModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        prompt={currentPrompt}
        onImport={handleImportFromModal}
      />

    </Box>
  );
};

export default ProjectList;
"""

# 4. src/features/editor/StoryEditor.tsx
files_content['src/features/editor/StoryEditor.tsx'] = """import React, { useState } from 'react';
import { 
  Box, Typography, Button, Paper, Chip, IconButton, Stack, CircularProgress, 
  Menu, MenuItem, ListItemIcon, ListItemText, Dialog, DialogTitle, DialogContent, 
  DialogActions, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, 
  Switch, ToggleButtonGroup, ToggleButton, Divider
} from '@mui/material';

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

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { setCurrentProject, updateProjectAsset } from '../projects/projectSlice';
import { addAsset } from '../assets/assetSlice';

// Components & Utils
import ImageGenModal from '../../components/ImageGenModal';
import MangaViewer from '../../components/MangaViewer';
import { generatePDF } from '../../utils/pdfExporter';
import type { PDFExportOptions } from '../../utils/pdfExporter';
import { generateImages } from '../../utils/imageExporter';
import type { AspectRatio } from '../../utils/imageExporter';
import { ImageBlock } from '../../types';

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
  // targetIndexをIDベースに変更 (string = blockId)
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

  // storyboardから画像ブロックだけを抽出
  const imageBlocks = project.storyboard.filter(b => b.type === 'image') as ImageBlock[];

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 3, paddingBottom: '8rem' }}>
      
      {/* Header Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ color: 'text.secondary' }}>
          リストに戻る
        </Button>
        
        <Stack direction="row" spacing={2}>
          {/* 画像DL Button */}
          <Button 
            variant="outlined" 
            color="info"
            startIcon={isExporting ? <CircularProgress size={20} /> : <DownloadIcon />}
            onClick={() => setImgExportOpen(true)}
            disabled={isExporting}
          >
            {isExporting ? exportMessage : "画像DL"}
          </Button>

          {/* PDF Export Dropdown */}
          <Box>
            <Button 
              variant="outlined" color="primary"
              startIcon={isExporting ? <CircularProgress size={20} /> : <PictureAsPdfIcon />}
              endIcon={!isExporting && <KeyboardArrowDownIcon />}
              onClick={handlePdfMenuOpen}
              disabled={isExporting}
            >
              PDF出力
            </Button>
            <Menu anchorEl={pdfMenuAnchor} open={Boolean(pdfMenuAnchor)} onClose={handlePdfMenuClose}>
              <MenuItem onClick={() => handleExportPDF({ scale: 2, quality: 0.9 })}>
                <ListItemIcon><HighQualityIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="高画質 (通常)" secondary="綺麗な印刷向け" />
              </MenuItem>
              <MenuItem onClick={() => handleExportPDF({ scale: 1, quality: 0.6, filenameSuffix: '_light' })}>
                <ListItemIcon><CompressIcon fontSize="small" /></ListItemIcon>
                <ListItemText primary="軽量版 (圧縮)" secondary="共有向け" />
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

      <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2, color: 'text.secondary' }}>ネーム構成 (全{imageBlocks.length}P)</Typography>
      <Stack spacing={2}>
        {imageBlocks.map((block) => (
          <Paper key={block.id} variant="outlined" sx={{ p: 2, display: 'flex', gap: 2, '&:hover': { borderColor: 'text.secondary' } }}>
            <Typography variant="h5" fontWeight="bold" color="text.disabled" sx={{ width: 40, textAlign: 'center', pt: 1 }}>{block.pageNumber}</Typography>
            {renderImagePlaceholder(block.assignedAssetId, () => handleGenStart(block.imagePrompt, block.id), (e) => handleDropAssign(e, block.id), "画像生成")}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>{block.sceneDescription}</Typography>
              <Paper variant="outlined" sx={{ p: 1.5, mb: 1, bgcolor: '#020617', borderLeft: 3, borderColor: 'primary.main' }}><Typography variant="body2" color="primary.light">{block.dialogue}</Typography></Paper>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="caption" fontFamily="monospace" color="text.disabled" noWrap sx={{ maxWidth: '80%', bgcolor: 'rgba(255,255,255,0.05)', px: 1, borderRadius: 0.5 }}>{block.imagePrompt}</Typography>
                <IconButton size="small" onClick={() => copyToClipboard(block.imagePrompt)}><ContentCopyIcon fontSize="small" /></IconButton>
              </Box>
            </Box>
          </Paper>
        ))}
      </Stack>

      <ImageGenModal open={modalOpen} onClose={() => setModalOpen(false)} prompt={currentPrompt} onPasteImage={handleGenFinish} />
      <MangaViewer open={viewerOpen} onClose={() => setViewerOpen(false)} project={project} getAssetUrl={getAssetUrl} />

      {/* Image Export Modal */}
      <Dialog open={imgExportOpen} onClose={() => setImgExportOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon color="info" /> 画像エクスポート設定
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Box>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>アスペクト比 (黒帯がつきます)</FormLabel>
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
              <ToggleButtonGroup
                value={exportRatio}
                exclusive
                onChange={(_, v) => v && setExportRatio(v)}
                fullWidth
                size="small"
                color="info"
                sx={{ mt: 1 }}
              >
                <ToggleButton value="4:5">4:5 (IG Feed)</ToggleButton>
                <ToggleButton value="5:4">5:4</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider />

            <FormControl fullWidth>
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>コンテンツ</FormLabel>
              <FormControlLabel
                control={<Switch checked={exportWithText} onChange={e => setExportWithText(e.target.checked)} />}
                label={exportWithText ? "テロップあり (字幕合成)" : "画像のみ (素材)"}
              />
            </FormControl>

            <Divider />

            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ mb: 1, fontSize: '0.85rem' }}>出力形式</FormLabel>
              <RadioGroup row value={exportMode} onChange={e => setExportMode(e.target.value as any)}>
                <FormControlLabel value="zip" control={<Radio />} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><FolderZipIcon fontSize="small"/> まとめてZIP</Box>} />
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

# 5. src/utils/projectIO.ts
files_content['src/utils/projectIO.ts'] = """import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Project, Asset, StoryBlock } from '../types';
import type { AppDispatch } from '../app/store';
import { addAsset } from '../features/assets/assetSlice';
import { createOrUpdateProject, setCurrentProject } from '../features/projects/projectSlice';
import { v4 as uuidv4 } from 'uuid';

/**
 * プロジェクトと使用画像をZIPにまとめてエクスポート
 */
export const exportProjectToZip = async (project: Project, assets: Asset[]) => {
  const zip = new JSZip();
  
  // 1. プロジェクトデータをJSONとして追加
  zip.file('project.json', JSON.stringify(project, null, 2));

  // 2. 使用されているアセットIDを収集
  const usedIds = new Set<string>();
  if (project.coverAssetId) usedIds.add(project.coverAssetId);
  project.storyboard.forEach(b => {
    if (b.type === 'image' && b.assignedAssetId) usedIds.add(b.assignedAssetId);
  });

  // 3. 画像ファイルを追加
  const assetsFolder = zip.folder('assets');
  if (assetsFolder) {
    for (const id of usedIds) {
      const asset = assets.find(a => a.id === id);
      if (asset) {
        try {
          // URLからBlobを取得してZIPに追加
          const res = await fetch(asset.url);
          const blob = await res.blob();
          // 拡張子の推定 (簡易的)
          const ext = blob.type.split('/')[1] || 'png';
          assetsFolder.file(`${id}.${ext}`, blob);
        } catch (e) {
          console.error(`Failed to export asset ${id}`, e);
        }
      }
    }
  }

  // 4. ZIP生成とダウンロード
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, `${project.title}.zip`);
};

/**
 * ZIPファイルからプロジェクトを復元
 */
export const importProjectFromZip = async (file: File, dispatch: AppDispatch) => {
  const zip = await JSZip.loadAsync(file);
  
  // 1. project.json を読む
  const projectFile = zip.file('project.json');
  if (!projectFile) throw new Error('project.json が見つかりません (無効なファイルです)');
  
  const projectJson = await projectFile.async('string');
  const rawProject = JSON.parse(projectJson);
  
  // 2. 画像を復元し、IDのマッピングを作成 (旧ID -> 新ID)
  const idMap = new Map<string, string>();
  const assetsFolder = zip.folder('assets');
  
  if (assetsFolder) {
    // フォルダ内のファイルを走査
    const entries: Array<{ name: string, fileObj: JSZip.JSZipObject }> = [];
    assetsFolder.forEach((relativePath, fileObj) => {
      entries.push({ name: relativePath, fileObj });
    });

    for (const entry of entries) {
      // ファイル名 (oldId.ext) から旧IDを取得
      const oldId = entry.name.split('.')[0];
      
      const blob = await entry.fileObj.async('blob');
      // Fileオブジェクト化
      const imageFile = new File([blob], entry.name, { type: blob.type });
      
      // Reduxアクションでアップロード（新規IDが発行される）
      const resultAction = await dispatch(addAsset({ file: imageFile, category: 'material' }));
      
      if (addAsset.fulfilled.match(resultAction)) {
        const newId = resultAction.payload.id;
        idMap.set(oldId, newId);
      }
    }
  }

  // 3. マイグレーション (pages -> storyboard)
  let storyboard: StoryBlock[] = [];
  if (rawProject.storyboard) {
    storyboard = rawProject.storyboard;
  } else if (rawProject.pages) {
    storyboard = rawProject.pages.map((p: any) => ({
      ...p,
      id: uuidv4(),
      type: 'image'
    }));
  }

  // 4. プロジェクトデータのIDを新しいものに書き換え
  const newProject: Project = {
    ...rawProject,
    id: uuidv4(), // プロジェクトIDも一新して「コピー」として扱う
    title: rawProject.title + " (Imported)",
    coverAssetId: rawProject.coverAssetId ? (idMap.get(rawProject.coverAssetId) || null) : null,
    storyboard: storyboard.map(b => {
        if (b.type === 'image') {
            return {
              ...b,
              assignedAssetId: b.assignedAssetId ? (idMap.get(b.assignedAssetId) || null) : null
            };
        }
        return b;
    }),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  // レガシーフィールドの削除
  if ('pages' in newProject) {
    delete (newProject as any).pages;
  }

  // 5. 保存して開く
  await dispatch(createOrUpdateProject(newProject));
  dispatch(setCurrentProject(newProject));
  
  return newProject;
};
"""

# 6. src/utils/pdfExporter.ts
files_content['src/utils/pdfExporter.ts'] = """import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Project, Asset, ImageBlock } from '../types';

// A4サイズ (mm)
const A4_WIDTH = 210;
const A4_HEIGHT = 297;

export interface PDFExportOptions {
  scale: number;   // 解像度倍率 (1=普通, 2=高画質)
  quality: number; // JPEG圧縮率 (0.1 ~ 1.0)
  filenameSuffix?: string; // ファイル名の接尾辞 (_compressed 等)
}

export const generatePDF = async (
  project: Project, 
  assets: Asset[],
  onProgress: (msg: string) => void,
  options: PDFExportOptions = { scale: 2, quality: 0.9 } // デフォルトは高画質
) => {
  // 1. PDF初期化
  const pdf = new jsPDF('p', 'mm', 'a4');
  const getAssetUrl = (id: string | null) => assets.find(a => a.id === id)?.url || '';

  // 2. 一時的なレンダリング用コンテナを作成（画面外）
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '-10000px';
  container.style.left = '-10000px';
  container.style.width = '210mm'; // A4幅
  container.style.minHeight = '297mm'; // A4高さ
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#000000';
  container.style.fontFamily = '"Helvetica Neue", Arial, sans-serif';
  document.body.appendChild(container);

  // --- Helper: HTMLからCanvas化してPDFに追加 ---
  const captureAndAddPage = async (isFirstPage: boolean) => {
    // 画像の読み込み待ち
    const images = container.querySelectorAll('img');
    await Promise.all(Array.from(images).map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
    }));

    // html2canvasで撮影 (★options.scale を適用)
    const canvas = await html2canvas(container, {
      scale: options.scale, 
      useCORS: true,
      logging: false,
    });

    // JPEG圧縮 (★options.quality を適用)
    const imgData = canvas.toDataURL('image/jpeg', options.quality);
    
    if (!isFirstPage) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, A4_WIDTH, A4_HEIGHT);
  };

  try {
    // ==========================================
    // 1. 表紙 (Cover Page)
    // ==========================================
    onProgress("表紙を生成中...");
    const coverUrl = getAssetUrl(project.coverAssetId);
    
    container.innerHTML = `
      <div style="padding: 40px; height: 297mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <h1 style="font-size: 42px; margin-bottom: 20px; font-weight: bold; color: #333;">${project.title}</h1>
        <div style="margin-bottom: 30px; display: flex; gap: 10px; justify-content: center;">
          <span style="border: 1px solid #666; padding: 5px 15px; border-radius: 20px; font-size: 14px;">${project.gachaResult.themeA}</span>
          <span style="border: 1px solid #666; padding: 5px 15px; border-radius: 20px; font-size: 14px;">${project.gachaResult.themeB}</span>
          <span style="background: #eee; padding: 5px 15px; border-radius: 20px; font-size: 14px;">★ ${project.gachaResult.secretIngredient}</span>
        </div>
        
        <div style="width: 80%; aspect-ratio: 2/3; background: #eee; margin-bottom: 30px; overflow: hidden; border: 4px solid #333;">
          ${coverUrl ? `<img src="${coverUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : '<div style="padding-top: 50%;">NO IMAGE</div>'}
        </div>

        <p style="font-size: 18px; line-height: 1.8; color: #555; max-width: 80%; margin-bottom: 40px; font-style: italic;">
          ${project.synopsis}
        </p>

        <div style="border-top: 1px solid #ccc; padding-top: 20px; width: 100%;">
          <p style="font-size: 12px; color: #999;">Generated by AI Manga Studio</p>
        </div>
      </div>
    `;
    await captureAndAddPage(true);

    // ==========================================
    // 2. 本編ページ (Story Pages)
    // ==========================================
    
    // 画像ブロックのみ抽出
    const imageBlocks = project.storyboard.filter(b => b.type === 'image') as ImageBlock[];

    for (let i = 0; i < imageBlocks.length; i++) {
      onProgress(`ページ生成中 (${i + 1}/${imageBlocks.length})...`);
      const page = imageBlocks[i];
      const pageUrl = getAssetUrl(page.assignedAssetId);

      container.innerHTML = `
        <div style="height: 297mm; position: relative; background: #000;">
          <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            ${pageUrl 
              ? `<img src="${pageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` 
              : '<div style="color: white;">NO IMAGE</div>'
            }
          </div>

          <div style="position: absolute; bottom: 50px; left: 50%; transform: translateX(-50%); width: 90%; background: rgba(0,0,0,0.8); color: white; padding: 20px; border-radius: 10px; border: 2px solid #555; text-align: center;">
            <p style="font-size: 24px; font-weight: bold; line-height: 1.5; margin: 0;">
              ${page.dialogue}
            </p>
          </div>

          <div style="position: absolute; bottom: 15px; right: 20px; color: #999; font-size: 14px;">
            - ${page.pageNumber} -
          </div>
        </div>
      `;
      await captureAndAddPage(false);
    }

    // 保存
    onProgress("保存中...");
    const suffix = options.filenameSuffix || '';
    pdf.save(`${project.title}${suffix}.pdf`);

  } catch (e) {
    console.error(e);
    alert("PDF生成に失敗しました");
  } finally {
    document.body.removeChild(container);
  }
};
"""

# 7. src/utils/imageExporter.ts
files_content['src/utils/imageExporter.ts'] = """import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import type { Project, Asset, ImageBlock } from '../types';

export type AspectRatio = '9:16' | '16:9' | '4:5' | '5:4';

interface ExportOptions {
  ratio: AspectRatio;
  withText: boolean;
  mode: 'zip' | 'single';
}

// 解像度定義 (短辺1080px基準)
const DIMENSIONS = {
  '9:16': { w: 1080, h: 1920 },
  '16:9': { w: 1920, h: 1080 },
  '4:5':  { w: 1080, h: 1350 },
  '5:4':  { w: 1350, h: 1080 },
};

export const generateImages = async (
  project: Project,
  assets: Asset[],
  options: ExportOptions,
  onProgress: (msg: string) => void
) => {
  const { w, h } = DIMENSIONS[options.ratio];
  const getAssetUrl = (id: string | null) => assets.find(a => a.id === id)?.url || '';
  
  // 1. コンテナ作成 (画面外)
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed', top: '-10000px', left: '-10000px',
    width: `${w}px`, height: `${h}px`,
    backgroundColor: '#000', // 黒背景 (レターボックス用)
    fontFamily: '"Helvetica Neue", Arial, sans-serif'
  });
  document.body.appendChild(container);

  const zip = new JSZip();
  const folder = zip.folder(project.title) || zip;

  // 画像ブロックのみ抽出
  const imageBlocks = project.storyboard.filter(b => b.type === 'image') as ImageBlock[];

  // 処理対象のページリスト
  const targets = options.mode === 'single' 
    ? [{ type: 'cover', data: project.coverAssetId, text: project.title }] 
    : [
        { type: 'cover', data: project.coverAssetId, text: project.title },
        ...imageBlocks.map(p => ({ type: 'page', data: p.assignedAssetId, text: p.dialogue, num: p.pageNumber }))
      ];

  try {
    for (let i = 0; i < targets.length; i++) {
      const item = targets[i];
      const isCover = item.type === 'cover';
      const label = isCover ? 'cover' : `page_${(item as any).num.toString().padStart(2, '0')}`;
      
      onProgress(`生成中: ${label} (${i + 1}/${targets.length})`);

      const imgUrl = getAssetUrl(item.data);

      // レイアウト構築
      container.innerHTML = `
        <div style="width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden;">
          ${imgUrl 
            ? `<img src="${imgUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` 
            : '<div style="color: #666; font-size: 40px;">NO IMAGE</div>'
          }

          ${options.withText ? `
            <div style="
              position: absolute; bottom: 10%; left: 50%; transform: translateX(-50%);
              width: 90%; text-align: center;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            ">
              <p style="
                color: white; font-size: 48px; font-weight: bold; margin: 0; line-height: 1.4;
                background: rgba(0,0,0,0.6); padding: 20px; border-radius: 16px; border: 2px solid rgba(255,255,255,0.3);
                display: inline-block;
              ">
                ${item.text || ''}
              </p>
            </div>
          ` : ''}
        </div>
      `;

      // 画像読み込み待機
      const images = container.querySelectorAll('img');
      await Promise.all(Array.from(images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      }));

      // 撮影
      const canvas = await html2canvas(container, {
        scale: 1, // 解像度はコンテナサイズで担保済み
        useCORS: true,
        logging: false,
      });

      // Blob化
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) continue;

      if (options.mode === 'single') {
        saveAs(blob, `${project.title}_${label}.jpg`);
      } else {
        folder.file(`${label}.jpg`, blob);
      }
    }

    // ZIP保存
    if (options.mode === 'zip') {
      onProgress('圧縮中...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${project.title}_images.zip`);
    }

  } catch (e) {
    console.error(e);
    alert('画像生成に失敗しました');
  } finally {
    document.body.removeChild(container);
  }
};
"""

# 8. src/components/MangaViewer.tsx
files_content['src/components/MangaViewer.tsx'] = """import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, Box, IconButton, Typography, Fade
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import type { Project, ImageBlock } from '../types';

interface MangaViewerProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  getAssetUrl: (id: string | null) => string | undefined;
}

const MangaViewer: React.FC<MangaViewerProps> = ({ open, onClose, project, getAssetUrl }) => {
  // -1: Cover, 0...N: Pages
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Reset on open
  useEffect(() => {
    if (open) setCurrentIndex(-1);
  }, [open]);

  // 画像ブロックのみ抽出
  const imageBlocks = project.storyboard.filter(b => b.type === 'image') as ImageBlock[];

  const totalPages = imageBlocks.length;
  const isCover = currentIndex === -1;
  const currentPage = !isCover ? imageBlocks[currentIndex] : null;

  // Navigation Logic
  const handleNext = useCallback(() => {
    if (currentIndex < totalPages - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, totalPages]);

  const handlePrev = useCallback(() => {
    if (currentIndex > -1) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  // Keyboard Support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNext, handlePrev, onClose]);

  // Content Resolver
  const currentImageUrl = isCover 
    ? getAssetUrl(project.coverAssetId) 
    : getAssetUrl(currentPage?.assignedAssetId || null);

  const currentText = isCover 
    ? project.synopsis 
    : currentPage?.dialogue;

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      sx={{ '& .MuiDialog-paper': { bgcolor: '#000' } }} // 完全な黒背景
    >
      {/* Close Button */}
      <IconButton 
        onClick={onClose} 
        sx={{ position: 'absolute', top: 16, right: 16, color: 'white', zIndex: 10, bgcolor: 'rgba(255,255,255,0.1)' }}
      >
        <CloseIcon />
      </IconButton>

      {/* Main Content Area */}
      <Box 
        sx={{ 
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', 
          alignItems: 'center', justifyContent: 'center', p: 2 
        }}
        onClick={handleNext} // Click anywhere to next
      >
        <Fade in={true} key={currentIndex} timeout={400}>
          <Box sx={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            maxWidth: '100%', maxHeight: '100%', gap: 2 
          }}>
            
            {/* Image Area */}
            <Box sx={{ position: 'relative', maxHeight: '75vh', maxWidth: '100vw' }}>
              {currentImageUrl ? (
                <Box 
                  component="img" 
                  src={currentImageUrl} 
                  sx={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', boxShadow: '0 0 20px rgba(255,255,255,0.1)' }}
                />
              ) : (
                <Box sx={{ 
                  width: '60vh', height: '60vh', bgcolor: '#1e293b', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column'
                }}>
                  <MenuBookIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                  <Typography>No Image</Typography>
                </Box>
              )}
              
              {/* Page Number Badge */}
              <Box sx={{ 
                position: 'absolute', bottom: 10, right: 10, 
                bgcolor: 'rgba(0,0,0,0.7)', color: 'white', px: 1.5, py: 0.5, borderRadius: 1,
                fontSize: '0.8rem', fontFamily: 'monospace'
              }}>
                {isCover ? 'COVER' : `P.${currentPage?.pageNumber}`}
              </Box>
            </Box>

            {/* Text Area (Subtitle Style) */}
            <Box sx={{ 
              width: '100%', maxWidth: 800, minHeight: 100,
              bgcolor: 'rgba(20, 20, 20, 0.8)', border: '1px solid #333', borderRadius: 2, 
              p: 3, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}>
              {isCover && (
                <Typography variant="h4" color="primary.main" fontWeight="bold" gutterBottom>
                  {project.title}
                </Typography>
              )}
              <Typography variant="h6" color="white" sx={{ fontStyle: isCover ? 'italic' : 'normal', lineHeight: 1.6 }}>
                {currentText || "..."}
              </Typography>
            </Box>

          </Box>
        </Fade>
      </Box>

      {/* Navigation Overlay Buttons (Mouse Hover) */}
      <Box sx={{ position: 'fixed', top: '50%', left: 20, transform: 'translateY(-50%)' }}>
        <IconButton onClick={(e) => { e.stopPropagation(); handlePrev(); }} disabled={currentIndex <= -1} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'primary.main' } }}>
          <NavigateBeforeIcon fontSize="large" />
        </IconButton>
      </Box>
      <Box sx={{ position: 'fixed', top: '50%', right: 20, transform: 'translateY(-50%)' }}>
        <IconButton onClick={(e) => { e.stopPropagation(); handleNext(); }} disabled={currentIndex >= totalPages - 1} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'primary.main' } }}>
          <NavigateNextIcon fontSize="large" />
        </IconButton>
      </Box>

    </Dialog>
  );
};

export default MangaViewer;
"""

# ファイル書き込み処理
for filepath, content in files_content.items():
    # ディレクトリが存在するか確認し、なければ作成
    dirpath = os.path.dirname(filepath)
    if dirpath and not os.path.exists(dirpath):
        os.makedirs(dirpath)
        print(f"Created directory: {dirpath}")
        
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        print(f"Updated: {filepath}")

print("\\nRefactoring complete.")