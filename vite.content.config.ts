import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: { entry: resolve(import.meta.dirname, 'src/content/index.ts'), name: 'AISelectionExplainer', formats: ['iife'], fileName: () => 'content.js' },
  },
});
