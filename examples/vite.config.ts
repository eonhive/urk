/**
 * Company: EonHive Inc.
 * Title: Examples Vite Config
 * Purpose: Ensure example HTML entrypoints are included in the production build.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-04-30
 * Notes: Vibe coded with Codex.
 */

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: [
        resolve(__dirname, 'index.html'),
        resolve(__dirname, 'audio-proof/index.html'),
        resolve(__dirname, 'app-shell/index.html'),
        resolve(__dirname, 'loading-transition/index.html'),
        resolve(__dirname, 'picking/index.html'),
        resolve(__dirname, 'react-starter/index.html'),
        resolve(__dirname, 'runtime-inspector/index.html'),
        resolve(__dirname, 'scrollytelling/index.html'),
      ],
    },
  },
});
