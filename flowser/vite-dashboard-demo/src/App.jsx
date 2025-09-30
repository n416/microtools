import React, { Suspense, lazy } from 'react'; // Suspenseとlazyをインポート
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, Box, CircularProgress } from '@mui/material'; // BoxとCircularProgressをインポート
import { theme } from './theme';

// ▼▼▼ 修正: ページコンポーネントを遅延読み込みに変更 ▼▼▼
const MainPage = lazy(() => import('./pages/MainPage'));
const FlowDesignerPage = lazy(() => import('./pages/FlowDesignerPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// ▲▲▲ 修正 ▲▲▲

function App() {
  return (
    <ThemeProvider theme={theme}>
      {/* ▼▼▼ 修正: SuspenseでRoutesをラップし、読み込み中のUIを指定 ▼▼▼ */}
      <Suspense 
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CircularProgress />
          </Box>
        }
      >
        <Routes>
          <Route path="/" element={<MainPage />} />
          <Route path="/designer" element={<FlowDesignerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Suspense>
      {/* ▲▲▲ 修正 ▲▲▲ */}
    </ThemeProvider>
  );
}

export default App;