import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jszip')) {
              return 'vendor-zip';
            }
            return 'vendor';
          }
          if (id.includes('src/fiscal/model-reconciliation-engine.ts')) {
            return 'engine-reconciliation';
          }
        },
      },
    },
  },
});
