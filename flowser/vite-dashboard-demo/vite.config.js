import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path'; // pathをインポート

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // お客様の既存設定である base を維持します
  base: './',
  // Reactのバージョン競合を解決するための設定を追加します
  resolve: {
    alias: {
      'react': path.resolve(__dirname, './node_modules/react'),
      'react-dom': path.resolve(__dirname, './node_modules/react-dom'),
    }
  }
});