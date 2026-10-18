/**
 * Company: EonHive Inc. | Title: Unpack Command
 * Purpose: Extract a validated portable experience into a hostable directory.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import { resolve } from 'node:path';
import { info, success } from '../utils/logger.js';

const HELP = `Usage: urk unpack <package.urkpkg> [--out-dir <directory>]

Validate and extract into an absent or empty directory. Existing files are never overwritten.
Output defaults to the archive path without .urkpkg; relative arguments resolve from the current directory.
Serve the extracted directory through HTTP. Browsers do not execute .urkpkg archives directly.
`;

export async function runUnpackCommand(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); return 0; }
  const { parsePackageArguments, unpackPackage } = await import('../utils/portable-package.js');
  const { directory, values } = parsePackageArguments(args, ['--out-dir']);
  if (!directory?.endsWith('.urkpkg')) throw new Error('Usage: urk unpack <package.urkpkg> [--out-dir <directory>].');
  const input = resolve(directory);
  const output = resolve(values['--out-dir'] ?? input.slice(0, -'.urkpkg'.length));
  await unpackPackage(input, output);
  success(`Unpacked portable experience to ${output}`);
  info('Serve this directory through HTTP, then open or embed its index.html URL.');
  return 0;
}
