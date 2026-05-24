/**
 * Company: EonHive Inc.
 * Title: CLI Project Detection Helpers
 * Purpose: Discover nearby package manifests and detect public URK package usage.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { dirname, join, resolve } from 'node:path';
import { readJsonFile, pathExists } from './fs.js';

type DependencyMap = Record<string, string>;

type PackageJsonValue = {
  dependencies?: DependencyMap;
  devDependencies?: DependencyMap;
  peerDependencies?: DependencyMap;
  optionalDependencies?: DependencyMap;
  [key: string]: unknown;
};

export type DetectedUrkPackages = {
  core: boolean;
  adapters: boolean;
  reactUrk: boolean;
  nextUrk: boolean;
};

/**
 * Walk upward from the provided directory until a package.json is found or the filesystem root is reached.
 * This lets CLI commands work from nested folders inside a project instead of only from the root.
 */
export async function findPackageJson(cwd: string): Promise<string | null> {
  let currentDirectory = resolve(cwd);

  while (true) {
    const packageJsonPath = join(currentDirectory, 'package.json');

    if (await pathExists(packageJsonPath)) {
      return packageJsonPath;
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

/**
 * Read the nearest package.json and return both its path and parsed value.
 * Callers often need the manifest directory as well as the manifest contents.
 */
export async function readNearestPackageJson(
  cwd: string,
): Promise<{ path: string; value: any } | null> {
  const packageJsonPath = await findPackageJson(cwd);

  if (!packageJsonPath) {
    return null;
  }

  return {
    path: packageJsonPath,
    value: await readJsonFile<PackageJsonValue>(packageJsonPath),
  };
}

function hasDependency(manifest: PackageJsonValue, packageName: string): boolean {
  const dependencyGroups = [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ];

  return dependencyGroups.some((group) => Boolean(group?.[packageName]));
}

/**
 * Detect whether the nearest package manifest references the public URK packages.
 * This keeps future CLI checks source-based and independent from runtime imports.
 */
export async function detectUrkPackages(cwd: string): Promise<DetectedUrkPackages> {
  const nearestPackageJson = await readNearestPackageJson(cwd);

  if (!nearestPackageJson) {
    return {
      core: false,
      adapters: false,
      reactUrk: false,
      nextUrk: false,
    };
  }

  const manifest = nearestPackageJson.value as PackageJsonValue;

  return {
    core: hasDependency(manifest, '@urk/core'),
    adapters: hasDependency(manifest, '@urk/adapters'),
    reactUrk: hasDependency(manifest, '@urk/react-urk'),
    nextUrk: hasDependency(manifest, '@urk/next-urk'),
  };
}
