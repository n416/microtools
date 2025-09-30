import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { store } from './store'; // 作成したStoreをインポート
import { Provider } from 'react-redux'; // Providerをインポート

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}> {/* App全体をProviderでラップする */}
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  </React.StrictMode>
);