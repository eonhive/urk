/**
 * Company: EonHive Inc. | Title: Player Browser Build
 * Purpose: Produce one optional browser module using the existing Vite toolchain.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'urk-player.js' },
    target: 'es2020',
    minify: true,
  },
});
