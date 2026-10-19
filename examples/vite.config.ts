/**
 * Company: EonHive Inc.
 * Title: Examples Vite Config
 * Purpose: Ensure example HTML entrypoints are included in the production build.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: [
        resolve(__dirname, 'motion-lab/index.html'),
        resolve(__dirname, 'motion-widget/index.html'),
        resolve(__dirname, 'motion-starter/index.html'),
        resolve(__dirname, 'motion-playground/index.html'),
        resolve(__dirname, 'selection-details/index.html'),
        resolve(__dirname, 'index.html'),
        resolve(__dirname, 'audio-proof/index.html'),
        resolve(__dirname, 'audio-proof/analysis.html'),
        resolve(__dirname, 'video-proof/index.html'),
        resolve(__dirname, 'interactive-media/index.html'),
        resolve(__dirname, 'experience-showcase/index.html'),
        resolve(__dirname, 'v02/index.html'),
        resolve(__dirname, 'v02/react.html'),
        resolve(__dirname, 'app-shell/index.html'),
        resolve(__dirname, 'loading-transition/index.html'),
        resolve(__dirname, 'picking/index.html'),
        resolve(__dirname, 'react-starter/index.html'),
        resolve(__dirname, 'runtime-inspector/index.html'),
        resolve(__dirname, 'scrollytelling/index.html'),
      ],
      output: {
        manualChunks(id) {
          const normalizedId = id.replaceAll('\\', '/');

          if (normalizedId.includes('/node_modules/three/')) {
            return 'vendor-three';
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/')
          ) {
            return 'vendor-react';
          }

          // Keep optional adapters out of the core chunk so media-only pages stay lightweight.
          if (normalizedId.includes('/packages/core/')) {
            return 'vendor-urk';
          }

          return undefined;
        },
      },
    },
  },
});
