import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.indexOf('node_modules/@chenglou/pretext') >= 0) {
            return 'pretext';
          }

          if (normalizedId.indexOf('node_modules/prosemirror') >= 0) {
            return 'prosemirror';
          }

          if (normalizedId.indexOf('node_modules/@tiptap') >= 0) {
            return 'tiptap';
          }

          if (
            normalizedId.indexOf('node_modules/@floating-ui') >= 0 ||
            normalizedId.indexOf('node_modules/fast-equals') >= 0 ||
            normalizedId.indexOf('node_modules/linkifyjs') >= 0
          ) {
            return 'editor-support';
          }

          return undefined;
        },
      },
    },
  },
});
