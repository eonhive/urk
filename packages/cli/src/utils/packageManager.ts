/**
 * Company: EonHive Inc.
 * Title: CLI Package Manager Helpers
 * Purpose: Detect a local package manager and format basic install and run commands.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { join } from 'node:path';
import { pathExists } from './fs.js';

export type PackageManager = 'yarn' | 'pnpm' | 'npm';

/**
 * Detect the package manager for a project by checking common lockfiles in priority order.
 * When no lockfile exists yet, default to Yarn to match the main URK repo style.
 */
export async function detectPackageManager(cwd: string): Promise<PackageManager> {
  if (await pathExists(join(cwd, 'yarn.lock'))) {
    return 'yarn';
  }

  if (await pathExists(join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }

  if (await pathExists(join(cwd, 'package-lock.json'))) {
    return 'npm';
  }

  return 'yarn';
}

/**
 * Return the plain install command for the chosen package manager.
 * Commands stay string-based for now because the CLI does not execute them directly yet.
 */
export function getInstallCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install';
    case 'npm':
      return 'npm install';
    case 'yarn':
    default:
      return 'yarn install';
  }
}

/**
 * Return the plain development command for the chosen package manager.
 * This keeps future next-step output consistent across generated projects.
 */
export function getDevCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm dev';
    case 'npm':
      return 'npm run dev';
    case 'yarn':
    default:
      return 'yarn dev';
  }
}

/**
 * Return the plain build command for the chosen package manager.
 * The helper centralizes package-manager wording so commands do not hard-code it repeatedly.
 */
export function getBuildCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm build';
    case 'npm':
      return 'npm run build';
    case 'yarn':
    default:
      return 'yarn build';
  }
}
