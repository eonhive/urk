/**
 * Company: EonHive Inc.
 * Title: URK Next Proof Config
 * Purpose: Configure the standalone App Router proof to resolve local URK workspaces through built package outputs.
 * Author: Stan Nesi
 * Created: 2026-04-30
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig = {
  distDir: process.env.URK_INTEGRATION_TEST === '1' ? '.next-integration' : '.next',
  webpack(config) {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@urk/core$': path.resolve(__dirname, '../../packages/core/dist/index.js'),
      '@urk/adapters$': path.resolve(__dirname, '../../packages/adapters/dist/index.js'),
      '@urk/adapters/dom$': path.resolve(__dirname, '../../packages/adapters/dist/dom.js'),
      '@urk/react$': path.resolve(__dirname, '../../packages/react/dist/index.js'),
      '@urk/next$': path.resolve(__dirname, '../../packages/next/dist/index.js'),
    };

    return config;
  },
};

export default nextConfig;
