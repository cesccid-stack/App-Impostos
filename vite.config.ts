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
            // jsPDF (+ its helper deps) is only needed when the user exports a
            // PDF. Return `undefined` so Rollup merges it with its dynamic
            // importer (the lazily-loaded pdf-generator chunk) instead of
            // pulling it into the eagerly preloaded `vendor` bundle.
            if (id.includes('jspdf') || id.includes('fflate') || id.includes('fast-png')) {
              return undefined;
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
