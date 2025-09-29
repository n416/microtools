import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // ▼▼▼ 修正点: baseを './' に設定します ▼▼▼
  base: './',
});