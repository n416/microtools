import os

# vite.config.ts を作成/上書き
# base: './' を追加することで、相対パスでのビルドを有効にします。

content = r"""import { defineConfig } from 'vite'
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
"""

file_path = 'vite.config.ts'
try:
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Successfully created/updated {file_path} with relative base path.")
except Exception as e:
    print(f"Error patching {file_path}: {e}")