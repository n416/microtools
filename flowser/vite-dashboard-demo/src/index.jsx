import React from 'react';
import ReactDOM from 'react-dom/client';
// ▼▼▼ 修正点: BrowserRouterの代わりにHashRouterをインポート ▼▼▼
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/* ▼▼▼ 修正点: BrowserRouterをHashRouterに変更 ▼▼▼ */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);