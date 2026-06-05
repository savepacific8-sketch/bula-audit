import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';

const API_TARGET = process.env.VITE_API_URL || 'http://localhost:4000';

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'info',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    host: true, // listen on LAN so phones on same Wi‑Fi can open the dev URL
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
    },
  },
});
