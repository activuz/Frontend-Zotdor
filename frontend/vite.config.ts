import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Same-origin in development so the session cookie is first-party (docs/ARCHITECTURE.md §8).
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      // Uploaded auction photos and videos (served by nginx in production).
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
});
