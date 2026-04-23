/**
 * Company: EonHive Inc.
 * Title: Examples Vite Config
 * Purpose: Ensure example HTML entrypoints are included in the production build.
 * Author: Stan Nesi
 * Created: 2026-04-22
 * Updated: 2026-04-23
 * Notes: Vibe coded with Codex.
 */

import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        appShell: resolve(__dirname, 'app-shell.html'),
        loadingTransition: resolve(__dirname, 'loading-transition.html'),
        scrollytelling: resolve(__dirname, 'scrollytelling.html'),
      },
    },
  },
});
