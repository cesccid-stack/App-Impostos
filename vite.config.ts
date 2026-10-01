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
            // jsPDF (+ its helper deps) is only needed when the user exports a PDF.
            // Putting it into a dedicated 'vendor-pdf' chunk avoids bloat in the main vendor bundle.
            if (id.includes('jspdf') || id.includes('fflate') || id.includes('fast-png')) {
              return 'vendor-pdf';
            }
            return 'vendor';
          }
          if (id.includes('src/utils/pdf-generator.ts')) {
            return 'pdf-generator';
          }
          if (id.includes('src/fiscal/model-reconciliation-engine.ts')) {
            return 'engine-reconciliation';
          }
        },
      },
    },
  },
});
