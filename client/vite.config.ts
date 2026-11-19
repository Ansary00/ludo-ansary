import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(dirname, '../shared/src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/socket.io': { target: 'http://localhost:4000', ws: true },
      '/api': { target: 'http://localhost:4000' },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
  },
});
