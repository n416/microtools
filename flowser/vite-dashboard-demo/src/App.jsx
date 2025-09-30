import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { theme } from './theme';
import MainPage from './pages/MainPage';
import FlowDesignerPage from './pages/FlowDesignerPage';
import SettingsPage from './pages/SettingsPage'; // ▼▼▼ 追加 ▼▼▼

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/designer" element={<FlowDesignerPage />} />
        <Route path="/settings" element={<SettingsPage />} /> {/* ▼▼▼ 追加 ▼▼▼ */}
      </Routes>
    </ThemeProvider>
  );
}

export default App;