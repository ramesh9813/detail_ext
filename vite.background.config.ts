import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// A standalone worker registers listeners without loading shared module chunks.
export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/background/index.ts'),
      name: 'SelectionExplainerBackground',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});
