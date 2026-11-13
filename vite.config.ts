import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  build: {
    emptyOutDir: true,
    rollupOptions: {
      input: { popup: resolve(import.meta.dirname, 'src/popup/index.html'), background: resolve(import.meta.dirname, 'src/background/index.ts') },
      output: { entryFileNames: '[name].js', chunkFileNames: 'assets/[name]-[hash].js' },
    },
  },
});
