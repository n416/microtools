import { defineConfig } from 'vite';
import path from 'path';
import publishPlugin from './scripts/vite_publish_plugin.js';

export default defineConfig({
  base: './',
  server: {
    port: 5173
  },
  plugins: [
    publishPlugin()
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        // admin.html is intentionally excluded
      }
    }
  }
});
