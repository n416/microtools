import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { fileURLToPath, URL } from 'node:url' // ← 'path'から変更

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // ↓ 'path.resolve'から変更
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})