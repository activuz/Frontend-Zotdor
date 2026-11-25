import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// On Vercel the API lives on another host (docs/DEPLOYMENT.md §3). Without VITE_API_URL every
// /api call would hit Vercel itself, so fail the build instead of shipping a broken panel.
if (process.env.VERCEL && !process.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is not set. In Vercel → Settings → Environment Variables add VITE_API_URL=https://api.zotdor.uz and redeploy.');
}

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
