/**
 * Company: EonHive Inc. | Title: Motion Browser Checks
 * Purpose: Run focused motion proofs against one standalone examples server.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: [
    'motion-lab.spec.ts',
    'motion-widget.spec.ts',
    'motion-playground.spec.ts',
    'scrollytelling-motion.spec.ts',
  ],
  outputDir: '../.codex/validation/motion-browser',
  webServer: {
    command: 'corepack yarn workspace urk-examples dev --host 127.0.0.1 --port 5174 --strictPort',
    url: 'http://127.0.0.1:5174/motion-lab/',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
