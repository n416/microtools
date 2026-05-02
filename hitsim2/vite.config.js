import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  publicDir: '.generated',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        data: resolve(__dirname, 'data.html'),
      },
    },
  },
});
