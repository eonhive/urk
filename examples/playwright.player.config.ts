/**
 * Company: EonHive Inc. | Title: Portable Player Browser Checks
 * Purpose: Run export/package/Player proofs with static HTTP servers, without development hosts.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  webServer: undefined,
  testMatch: ['player.spec.ts', 'portable-export.spec.ts', 'portable-workflow.spec.ts'],
  outputDir: '../.codex/validation/player-browser',
});
