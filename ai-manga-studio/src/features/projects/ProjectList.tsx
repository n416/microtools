import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, Typography, Card, CardContent, TextField, Button, Chip, IconButton, 
  List, ListItemButton, ListItemText, Divider, Stack, Menu, MenuItem, ListItemIcon
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import FolderIcon from '@mui/icons-material/Folder';

// Libs
import { v4 as uuidv4 } from 'uuid';

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchProjects, createOrUpdateProject, setCurrentProject, deleteProject } from './projectSlice';
import type { Project } from '../../types';

// Components & Utils
import StoryGenModal from '../../components/StoryGenModal';
import { exportProjectToZip, importProjectFromZip } from '../../utils/projectIO';

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector(state => state.projects);
  const assets = useAppSelector(state => state.assets.items);

  // Local State
  const [genres, setGenres] = useState<string[]>(['サイバーパンク', '日常']);
  const [newGenre, setNewGenre] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  // Menu State
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchProjects());
    }
  }, [status, dispatch]);

  // --- Handlers: Genres ---
  const handleAddGenre = () => {
    if (newGenre.trim()) {
      setGenres([...genres, newGenre.trim()]);
      setNewGenre('');
    }
  };
  const handleDeleteGenre = (index: number) => {
    setGenres(genres.filter((_, i) => i !== index));
  };

  // --- Handlers: Project Creation ---
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

      const newProject: Project = {
        id: uuidv4(),
        ...data,
        pages: data.pages.map((p: any) => ({ ...p, assignedAssetId: null })),
        coverAssetId: null,
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

  // --- Handlers: Project Menu ---
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
                // ★修正: ここに position: 'relative' を追加しました
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

              {/* Menu Button */}
              {/* カードがrelativeになったので、このabsoluteは正しくカードの右上に配置されます */}
              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                <IconButton onClick={(e) => handleMenuOpen(e, p.id)} size="small">
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </Card>
          ))}
        </List>
      )}

      {/* Project Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleExportZIP}>
          <ListItemIcon><FolderZipIcon fontSize="small" /></ListItemIcon>
          <ListItemText>ZIPエクスポート</ListItemText>
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