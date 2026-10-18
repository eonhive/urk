/**
 * Company: EonHive Inc. | Title: Desktop Package Storage
 * Purpose: Snapshot and validate archives with the existing CLI before exposing read-only web files.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { constants } from 'node:fs';
import { chmod, mkdir, mkdtemp, open, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join } from 'node:path';
import { PACKAGE_LIMITS, unpackPackage, type PackageManifest } from '@urk/cli/portable-package';

export type OpenPackage = { directory: string; temporary: string; digest: string; manifest: PackageManifest };

export async function preparePackage(source: string, temporaryRoot: string): Promise<OpenPackage> {
  if (extname(source).toLowerCase() !== '.urkpkg') throw new Error('Choose a .urkpkg file created with urk pack.');
  const input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
  let temporary: string | undefined;
  try {
    const info = await input.stat();
    if (!info.isFile() || info.size > PACKAGE_LIMITS.archive) throw new Error('Package must be a regular file no larger than 256 MiB.');
    await mkdir(temporaryRoot, { recursive: true, mode: 0o700 });
    temporary = await mkdtemp(join(temporaryRoot, 'package-'));
    const snapshot = join(temporary, 'source.urkpkg');
    const output = await open(snapshot, 'wx', 0o600);
    const hash = createHash('sha256');
    try {
      // Hash the same private snapshot that will be validated, not a changeable external path.
      const buffer = Buffer.alloc(64 * 1024);
      let total = 0;
      while (true) {
        const { bytesRead } = await input.read(buffer, 0, buffer.length, null);
        if (!bytesRead) break;
        total += bytesRead;
        if (total > PACKAGE_LIMITS.archive) throw new Error('Package exceeds the 256 MiB archive limit.');
        const chunk = buffer.subarray(0, bytesRead);
        hash.update(chunk);
        let written = 0;
        while (written < bytesRead) {
          const result = await output.write(chunk, written, bytesRead - written);
          if (!result.bytesWritten) throw new Error('Could not copy the package. Check available disk space.');
          written += result.bytesWritten;
        }
      }
    } finally { await output.close(); }
    const directory = join(temporary, 'site');
    const report = await unpackPackage(snapshot, directory);
    for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) await chmod(join(entry.parentPath, entry.name), 0o444);
    }
    await rm(snapshot);
    return { temporary, directory, digest: hash.digest('hex'), manifest: report.manifest };
  } catch (error) {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    throw error;
  } finally { await input.close(); }
}

export async function releasePackage(packageData: OpenPackage): Promise<void> {
  await rm(packageData.temporary, { recursive: true, force: true });
}
