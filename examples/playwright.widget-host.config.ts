/**
 * Company: EonHive Inc. | Title: Website Motion Widget Browser Check
 * Purpose: Verify shared widget ownership in the existing website and docs hosts.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { defineConfig } from '@playwright/test';
import base from './playwright.config';

const port = process.env.URK_WEBSITE_PORT ?? '4322';

export default defineConfig({
  ...base,
  testMatch: 'embedded-motion.spec.ts',
  outputDir: '../.codex/validation/widget-host',
  webServer: {
    command: `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}/examples/embedded-docs-demo/`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
