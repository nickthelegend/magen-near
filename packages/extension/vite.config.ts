import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { fs: { allow: [resolve(__dirname, '../..')] } },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022', rollupOptions: { input: { popup: resolve(__dirname, 'popup.html'), approve: resolve(__dirname, 'approve.html') } } },
  worker: { format: 'es' },
});
