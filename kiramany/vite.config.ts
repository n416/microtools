import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // ★重要: 相対パスでビルドする設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})
