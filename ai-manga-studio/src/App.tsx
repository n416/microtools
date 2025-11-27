import { useState, useEffect, useRef } from 'react';
import { Box, AppBar, Toolbar, Typography, IconButton, Tooltip } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebar';

// Features
import AssetPool from './features/assets/AssetPool';
import ProjectList from './features/projects/ProjectList';
import StoryEditor from './features/editor/StoryEditor';

// Redux
import { useAppSelector } from './app/hooks';

// 定数
const MIN_PANE_WIDTH = 200; // 最小幅
const DEFAULT_WIDTH = 400;  // デフォルト幅
const STORAGE_KEY = 'ai-manga-studio-pane-width'; // 保存キー

function App() {
  const currentProject = useAppSelector(state => state.projects.currentProject);
  const assets = useAppSelector(state => state.assets.items);
  
  // UI State
  const [showAssetPool, setShowAssetPool] = useState(true);
  const [rightPaneWidth, setRightPaneWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  
  // EventListener内で最新の幅を参照するためのRef
  const widthRef = useRef(DEFAULT_WIDTH);

  // 1. 初期ロード時にLocalStorageから幅を復元
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const w = parseInt(saved, 10);
      if (!isNaN(w) && w > MIN_PANE_WIDTH) {
        setRightPaneWidth(w);
        widthRef.current = w;
      }
    }
  }, []);

  // Helper to resolve asset URL
  const getAssetUrl = (id: string | null) => {
    if (!id) return undefined;
    return assets.find(a => a.id === id)?.url;
  };

  // --- Resizing Logic ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = 'col-resize'; // ドラッグ中はカーソル固定
    document.body.style.userSelect = 'none';   // テキスト選択防止
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // 右端からの距離 = 新しい幅
      const newWidth = window.innerWidth - e.clientX;
      
      // 画面幅に応じた制限 (左ペインも最低限確保)
      const maxLimit = window.innerWidth - MIN_PANE_WIDTH; 
      
      if (newWidth >= MIN_PANE_WIDTH && newWidth <= maxLimit) {
        setRightPaneWidth(newWidth);
        widthRef.current = newWidth;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // ドラッグ終了時に保存
      localStorage.setItem(STORAGE_KEY, widthRef.current.toString());
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1} sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar variant="dense">
          <DashboardIcon sx={{ mr: 2, color: 'primary.main' }} />
          <Typography variant="h6" color="text.primary" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            AI Manga Studio
          </Typography>
          
          <Tooltip title={showAssetPool ? "画像プールを隠す" : "画像プールを表示"}>
            <IconButton 
              onClick={() => setShowAssetPool(!showAssetPool)}
              color={showAssetPool ? "primary" : "default"}
            >
              <ViewSidebarIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Pane (Project / Editor) */}
        {/* flex: 1 で残りの領域を埋める */}
        <Box sx={{ 
          flex: 1,
          borderRight: showAssetPool ? 0 : 1, // ハンドルがあるときはボーダー不要
          borderColor: 'divider', 
          display: 'flex', flexDirection: 'column', 
          bgcolor: 'background.default',
          minWidth: 0 // Flexbox overflow対策
        }}>
           {currentProject ? (
             <StoryEditor getAssetUrl={getAssetUrl} />
           ) : (
             <ProjectList />
           )}
        </Box>

        {/* Resizer Handle */}
        <Box
          onMouseDown={handleMouseDown}
          sx={{
            width: '4px',
            cursor: 'col-resize',
            bgcolor: isDragging ? 'primary.main' : 'divider',
            display: showAssetPool ? 'block' : 'none',
            zIndex: 10,
            transition: 'background-color 0.2s',
            '&:hover': {
              bgcolor: 'primary.main',
            }
          }}
        />

        {/* Right Pane (Assets) */}
        <Box sx={{ 
          width: showAssetPool ? rightPaneWidth : 0, 
          display: showAssetPool ? 'block' : 'none',
          height: '100%', 
          borderLeft: 0, 
          flexShrink: 0, // 幅を固定
          transition: isDragging ? 'none' : 'width 0.2s ease', // ドラッグ中はアニメーションを切る（軽快にするため）
          overflow: 'hidden'
        }}>
          <AssetPool />
        </Box>

      </Box>
    </Box>
  );
}

export default App;