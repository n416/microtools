import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import Header from './components/Header'; // ヘッダーをインポート

// ページを遅延読み込み
const ShiftCalendarPage = lazy(() => import('./pages/ShiftCalendarPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// ★★★ 修正: データ管理ページのコメントアウトを解除 ★★★
const DataManagementPage = lazy(() => import('./pages/DataManagementPage'));

// export "default" function App()
export default function App() { 
  return (
    // 全体を縦に並べる
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      
      {/* 1. ヘッダーを常時表示 */}
      <Header />
      
      {/* 2. ページ本体 (URLに応じて切り替わる) */}
      <Suspense fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      }>
        <Routes>
          <Route path="/" element={<ShiftCalendarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* ★★★ 修正: データ管理ページのコメントアウトを解除 ★★★ */}
          <Route path="/data" element={<DataManagementPage />} />
        </Routes>
      </Suspense>
      
    </Box>
  );
}