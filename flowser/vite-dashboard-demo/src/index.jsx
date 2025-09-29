import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* ▼▼▼ 修正点: basenameを追加 ▼▼▼ */}
    <BrowserRouter basename="/flowser/vite-dashboard-demo/dist/">
      <App />
    </BrowserRouter>
    {/* ▲▲▲ 修正点 ▲▲▲ */}
  </React.StrictMode>
);