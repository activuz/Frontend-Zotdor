import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// On Vercel the API lives on another host (docs/DEPLOYMENT.md §3). Without VITE_API_URL every
// /api call would hit Vercel itself, so fail the build instead of shipping a broken site.
if (process.env.VERCEL && !process.env.VITE_API_URL) {
  throw new Error('VITE_API_URL is not set. In Vercel → Settings → Environment Variables add VITE_API_URL=https://api.zotdor.uz and redeploy.');
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // Busts the on-device query cache (src/api/persist.ts) on every deploy.
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'),
  },
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
