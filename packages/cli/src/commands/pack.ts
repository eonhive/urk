/**
 * Company: EonHive Inc. | Title: Pack Command
 * Purpose: Distribute an exported website as one ZIP-compatible uRK package.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import { basename, dirname, resolve } from 'node:path';
import { success } from '../utils/logger.js';

const HELP = `Usage: urk pack [directory] [options]

Package already-exported web files; this command does not build the project.

Options:
  --out <file>         Archive path (default: <input-directory>.urkpkg)
  --name <name>        Experience name (default: directory or project name)
  --version <version>  Experience version (default: 0.1.0)
  --type <type>        Metadata token such as game, app, widget (default: experience)
  --overwrite         Replace an existing archive after successful packaging
  -h, --help          Show this help

Input defaults to ./dist. Output and input arguments resolve from the current directory.
Export first with urk export --base ./; recipients unpack and host the files through HTTP.
`;

export async function runPackCommand(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); return 0; }
  const { packWebsite, parsePackageArguments } = await import('../utils/portable-package.js');
  const { directory, values, overwrite } = parsePackageArguments(args, ['--out', '--name', '--version', '--type'], true);
  const input = resolve(directory ?? 'dist');
  const output = resolve(values['--out'] ?? `${input}.urkpkg`);
  if (!output.endsWith('.urkpkg')) throw new Error('Package output must end in .urkpkg.');
  const name = basename(basename(input) === 'dist' ? dirname(input) : input);
  await packWebsite(input, output, {
    formatVersion: 1,
    name: values['--name'] ?? name,
    version: values['--version'] ?? '0.1.0',
    type: values['--type'] ?? 'experience',
    entrypoint: 'index.html',
  }, overwrite);
  success(`Packed portable experience: ${output}`);
  return 0;
}
