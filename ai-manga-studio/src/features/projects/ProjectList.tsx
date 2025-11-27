import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Card, CardContent, TextField, Button, Chip,
  List, ListItemButton, ListItemText, Divider, Stack 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
// DeleteOutlineIcon 削除

// Redux
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { fetchProjects, createOrUpdateProject, setCurrentProject } from './projectSlice';
import type { Project } from '../../types'; // ← import type に修正

// Components
import StoryGenModal from '../../components/StoryGenModal'; // ← ファイルが存在することを確認してください
import { v4 as uuidv4 } from 'uuid';

const ProjectList: React.FC = () => {
  const dispatch = useAppDispatch();
  const { items, status } = useAppSelector(state => state.projects);

  // Local State for Generator
  const [genres, setGenres] = useState<string[]>(['サイバーパンク', '日常']);
  const [newGenre, setNewGenre] = useState('');
  
  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState('');

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchProjects());
    }
  }, [status, dispatch]);

  // --- Genre Handlers ---
  const handleAddGenre = () => {
    if (newGenre.trim()) {
      setGenres([...genres, newGenre.trim()]);
      setNewGenre('');
    }
  };

  const handleDeleteGenre = (index: number) => {
    setGenres(genres.filter((_, i) => i !== index));
  };

  // --- Story Generation Logic ---
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

  const handleImport = async (jsonStr: string) => {
    try {
      // JSON Cleaning (remove markdown code blocks if present)
      let clean = jsonStr.trim().replace(/```json/g, '').replace(/```/g, '');
      const s = clean.indexOf('{');
      const e = clean.lastIndexOf('}');
      if (s > -1 && e > -1) clean = clean.substring(s, e + 1);
      
      // Parse
      const data = JSON.parse(clean);
      if (!data.pages) throw new Error("ページデータがありません");

      // Create Project Object
      const newProject: Project = {
        id: uuidv4(),
        ...data,
        pages: data.pages.map((p: any) => ({ ...p, assignedAssetId: null })),
        coverAssetId: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      // Save to Redux & DB
      await dispatch(createOrUpdateProject(newProject));
      dispatch(setCurrentProject(newProject)); // Select it immediately
      setModalOpen(false);

    } catch (e: any) {
      alert('JSON読み込みエラー: ' + e.message);
    }
  };

  const handleSelectProject = (project: Project) => {
    dispatch(setCurrentProject(project));
  };

  return (
    <Box sx={{ p: 3, height: '100%', overflowY: 'auto' }}>
      
      {/* 1. New Project Card */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}>
        新規プロジェクト
      </Typography>
      <Card variant="outlined" sx={{ mb: 4, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>漫画のテーマ・ジャンル</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
            {genres.map((g, i) => (
              <Chip key={i} label={g} onDelete={() => handleDeleteGenre(i)} />
            ))}
          </Stack>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField 
              size="small" 
              placeholder="ジャンルを追加..." 
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
          >
            物語を生成 (APIなし)
          </Button>
        </CardContent>
      </Card>

      <Divider sx={{ mb: 4 }} />

      {/* 2. Project List */}
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: 'text.secondary' }}>
        プロジェクトリスト
      </Typography>
      
      {items.length === 0 ? (
        <Typography variant="body2" color="text.disabled">まだプロジェクトがありません。</Typography>
      ) : (
        <List>
          {items.map(p => (
            <Card key={p.id} variant="outlined" sx={{ mb: 1, '&:hover': { borderColor: 'primary.main' } }}>
              <ListItemButton onClick={() => handleSelectProject(p)} sx={{ display: 'block' }}>
                <ListItemText 
                  primary={
                    <Typography variant="subtitle1" fontWeight="bold">{p.title}</Typography>
                  }
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {p.synopsis}
                      </Typography>
                      <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
                        更新: {new Date(p.updatedAt).toLocaleDateString()}
                      </Typography>
                    </>
                  }
                />
              </ListItemButton>
            </Card>
          ))}
        </List>
      )}

      {/* Modal */}
      <StoryGenModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        prompt={currentPrompt}
        onImport={handleImport}
      />

    </Box>
  );
};

export default ProjectList;