/**
 * Company: EonHive Inc.
 * Title: Ownership Browser Integration Configuration
 * Purpose: Run reproducible React and Next ownership tests against isolated local hosts.
 * Author: Stan Nesi
 * Created: 2026-10-04
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const websitePort = process.env.URK_WEBSITE_PORT ?? '4322';

export default defineConfig({
  testDir: './tests/browser',
  outputDir: '../.codex/validation/ownership-browser',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  retries: 0,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: '../.codex/validation/ownership-report', open: 'never' }]]
    : 'list',
  projects: (process.env.URK_BROWSER_MATRIX === '1'
    ? ['chromium', 'firefox', 'webkit'] as const
    : ['chromium'] as const).map(browserName => ({ name: browserName, use: { browserName } })),
  use: { headless: true, trace: 'retain-on-failure' },
  webServer: [{
    command: 'corepack yarn workspace urk-examples dev --host 127.0.0.1 --port 5174 --strictPort',
    cwd: repoRoot,
    url: 'http://127.0.0.1:5174/tests/fixtures/index.html',
    reuseExistingServer: false,
    timeout: 120000,
  }, {
    command: 'corepack yarn workspace @urk/next-proof exec next dev --hostname 127.0.0.1 --port 3102',
    cwd: repoRoot,
    env: { URK_INTEGRATION_TEST: '1' },
    url: 'http://127.0.0.1:3102/ownership',
    reuseExistingServer: false,
    timeout: 120000,
  }, {
    command: `corepack yarn workspace @urk/www dev --host 127.0.0.1 --port ${websitePort}`,
    cwd: repoRoot,
    url: `http://127.0.0.1:${websitePort}/playground/`,
    reuseExistingServer: false,
    timeout: 120000,
  }],
});
