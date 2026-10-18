/**
 * Company: EonHive Inc. | Title: Embed Command
 * Purpose: Copy the existing Player module and generate a deployable static hosting page.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmbedTemplate, type EmbedOptions } from '../templates/embed.js';
import { info, success } from '../utils/logger.js';

const HELP = `Usage: urk embed <experience-url> [options]

Generate a static Player page for an already-hosted trusted HTTP(S) export.
Does not fetch the URL, build the experience, or deploy files.

Options:
  --out-dir <directory>  Absent or empty output directory (default: ./embed)
  --title <text>         Page and iframe title (default: uRK experience)
  --height <length>      Positive px, vh, dvh, svh, or rem length (default: 70vh)
  --fullscreen           Enable optional fullscreen controls/permission
  --check-src            Enable the Player's optional CORS HEAD check
  -h, --help             Show this help

Host the generated directory on a DIFFERENT origin from the experience.
Visitors need no Node or development tools. No existing files are overwritten.
`;

function parseOptions(args: string[]): EmbedOptions & { outDir: string } {
  const options = { src: '', outDir: 'embed', title: 'uRK experience', height: '70vh', fullscreen: false, checkSrc: false };
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--fullscreen') options.fullscreen = true;
    else if (argument === '--check-src') options.checkSrc = true;
    else if (/^--(out-dir|title|height)(=|$)/.test(argument)) {
      const separator = argument.indexOf('=');
      const flag = separator < 0 ? argument : argument.slice(0, separator);
      const value = separator < 0 ? args[++index] : argument.slice(separator + 1);
      if (!value || value.startsWith('-')) throw new Error(`${flag} requires a value. See urk embed --help.`);
      if (flag === '--out-dir') options.outDir = value;
      else if (flag === '--title') options.title = value;
      else options.height = value;
    } else if (argument.startsWith('-')) throw new Error(`Unknown embed option: ${argument}. See urk embed --help.`);
    else if (options.src) throw new Error('Embed accepts one experience URL. See urk embed --help.');
    else options.src = argument;
  }
  let url: URL;
  try { url = new URL(options.src); }
  catch { throw new Error('Provide an absolute HTTP(S) experience URL. See urk embed --help.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an absolute HTTP(S) experience URL without embedded credentials.');
  }
  if (url.pathname.toLowerCase().endsWith('.urkpkg')) throw new Error('Unpack the .urkpkg and host its index.html before generating an embed.');
  options.src = url.href;
  if (!options.title.trim() || options.title.length > 200 || /[\x00-\x1f\x7f]/.test(options.title)) {
    throw new Error('--title must contain 1–200 characters without control characters.');
  }
  if (!/^(?:\d+(?:\.\d+)?|\.\d+)(?:px|vh|dvh|svh|rem)$/.test(options.height) ||
      !Number.isFinite(parseFloat(options.height)) || parseFloat(options.height) <= 0) {
    throw new Error('--height requires a positive CSS length such as 640px or 70vh (px, vh, dvh, svh, rem).');
  }
  return options;
}

async function inspectPath(path: string) {
  try { return await lstat(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function checkDestination(output: string): Promise<void> {
  const fromOutput = relative(output, await realpath(process.cwd()));
  if (fromOutput === '' || (!isAbsolute(fromOutput) && fromOutput !== '..' && !fromOutput.startsWith(`..${sep}`))) {
    throw new Error('Embed output must not be the working directory or its ancestor.');
  }
  for (let path = output; ; path = dirname(path)) {
    if ((await inspectPath(path))?.isSymbolicLink()) throw new Error(`Embed output must not traverse a symlink: ${path}`);
    if (['.git', 'node_modules'].includes(basename(path))) throw new Error('Embed output must not be inside .git or node_modules.');
    if (dirname(path) === path) break;
  }
  const existing = await inspectPath(output);
  if (existing && (!existing.isDirectory() || (await readdir(output)).length)) {
    throw new Error(`Embed output must be an absent or empty directory: ${output}. Choose a new --out-dir.`);
  }
}

async function playerModule(): Promise<Buffer> {
  try {
    // Resolve the installed package without importing browser code into Node, or relying on repository paths.
    return await readFile(fileURLToPath(import.meta.resolve('@urk/player')));
  } catch {
    throw new Error('The compiled @urk/player module is missing. Reinstall @urk/cli; in this repository run node scripts/build.mjs @urk/cli.');
  }
}

export async function runEmbedCommand(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(HELP); return 0; }
  const options = parseOptions(args);
  const output = resolve(options.outDir);
  await checkDestination(output);
  const module = await playerModule();
  const files = createEmbedTemplate(options);
  await mkdir(dirname(output), { recursive: true });
  const temporary = await mkdtemp(join(dirname(output), '.urk-embed-'));
  try {
    for (const [name, content] of Object.entries(files)) await writeFile(join(temporary, name), content);
    await writeFile(join(temporary, 'urk-player.js'), module);
    await checkDestination(output);
    // rmdir removes only an empty directory; a concurrently added file is never deleted.
    if (await inspectPath(output)) await rmdir(output);
    await rename(temporary, output);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  success(`Generated static Player host in ${output}`);
  info(`Host this directory on a different origin from ${new URL(options.src).origin}. See HOSTING.txt.`);
  return 0;
}
