import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Staff panel (docs/ARCHITECTURE.md). Same-origin API proxy so the session cookie is first-party.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
      '/media': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
});
