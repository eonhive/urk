/**
 * Company: EonHive Inc.
 * Title: CLI Filesystem Helpers
 * Purpose: Provide small filesystem primitives for future URK CLI commands.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { constants } from 'node:fs';
import {
  access,
  copyFile,
  mkdir,
  readdir,
  readFile,
  readlink,
  symlink,
  writeFile as writeFileInternal,
} from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * Check whether a path exists without throwing when it does not.
 * This keeps command code simple when it only needs a boolean existence check.
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a directory exists before a command writes into it.
 * Recursive creation keeps nested scaffold paths straightforward.
 */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

/**
 * Write a file only when it is currently missing.
 * This helper is useful for scaffold steps that should never overwrite user work.
 */
export async function writeFileIfMissing(path: string, content: string): Promise<void> {
  if (await pathExists(path)) {
    return;
  }

  await writeFile(path, content);
}

/**
 * Write UTF-8 text to disk and create parent directories first.
 * Commands can rely on this helper instead of repeating directory setup logic.
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFileInternal(path, content, 'utf8');
}

/**
 * Read a UTF-8 text file from disk.
 * Commands can use this for safe source-file inspection without repeating encoding details.
 */
export async function readTextFile(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

/**
 * Read and parse a JSON file with a caller-provided result type.
 * The generic keeps the helper strict-friendly without tying it to a specific schema.
 */
export async function readJsonFile<T>(path: string): Promise<T> {
  const content = await readTextFile(path);

  return JSON.parse(content) as T;
}

/**
 * Serialize a value as readable JSON and write it with a trailing newline.
 * Pretty output makes generated manifests and config files easier to review.
 */
export async function writeJsonFile(path: string, value: unknown): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, content);
}

/**
 * Copy a directory tree recursively using only Node built-ins.
 * This keeps future template-copy flows dependency-light and explicit.
 */
export async function copyDirectory(source: string, target: string): Promise<void> {
  await ensureDir(target);

  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(source, entry.name);
    const targetPath = join(target, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isSymbolicLink()) {
      const linkedPath = await readlink(sourcePath);
      await symlink(linkedPath, targetPath);
      continue;
    }

    await ensureDir(dirname(targetPath));
    await copyFile(sourcePath, targetPath);
  }
}
