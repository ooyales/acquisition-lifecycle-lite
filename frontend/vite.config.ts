import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5009',
        changeOrigin: true,
      },
      '/apidocs': {
        target: process.env.VITE_API_URL || 'http://localhost:5009',
        changeOrigin: true,
        rewrite: (path: string) => path === '/apidocs' ? '/apidocs/' : path,
      },
      '/flasgger_static': {
        target: process.env.VITE_API_URL || 'http://localhost:5009',
        changeOrigin: true,
      },
      '/apispec.json': {
        target: process.env.VITE_API_URL || 'http://localhost:5009',
        changeOrigin: true,
      },
    },
  },
});
