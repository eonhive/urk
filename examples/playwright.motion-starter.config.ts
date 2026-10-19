/**
 * Company: EonHive Inc. | Title: Independent Motion Starter Check
 * Purpose: Verify the exported project against static HTTP hosts without development servers.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  webServer: undefined,
  testMatch: 'motion-starter.spec.ts',
  outputDir: '../.codex/validation/motion-starter',
});
