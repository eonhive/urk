/**
 * Company: EonHive Inc. | Title: Web Export Command
 * Purpose: Build an existing browser experience with Vite and safely publish its static files.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */

import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { info, success } from '../utils/logger.js';

const HELP = `Usage: urk export [directory] [options]

Build a browser project containing index.html using its existing Vite configuration.

Options:
  --out-dir <directory>  Output directory, relative to the project (default: dist)
  --base <path>          Hosting base path (default: ./)
  --overwrite            Replace a nonempty output directory after a successful build
  -h, --help             Show this help

Upload the entire output directory to a static HTTP host. Visitors need no Node or uRK tools.
`;

type ExportOptions = { directory: string; outDir: string; base: string; overwrite: boolean };

function parseOptions(args: string[]): ExportOptions {
  const options = { directory: '.', outDir: 'dist', base: './', overwrite: false };
  let hasDirectory = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--overwrite') {
      options.overwrite = true;
    } else if (/^--(out-dir|base)(=|$)/.test(argument)) {
      const separator = argument.indexOf('=');
      const flag = separator < 0 ? argument : argument.slice(0, separator);
      const value = separator < 0 ? args[++index] : argument.slice(separator + 1);
      if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
      if (flag === '--out-dir') options.outDir = value;
      else options.base = value;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown export option: ${argument}. See urk export --help.`);
    } else if (hasDirectory) {
      throw new Error('Export accepts one project directory. See urk export --help.');
    } else {
      options.directory = argument;
      hasDirectory = true;
    }
  }
  return options;
}

function contains(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
}

async function inspectPath(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function checkDestination(root: string, output: string, overwrite: boolean): Promise<void> {
  if (contains(output, root)) throw new Error('Export output must not be the project directory or its ancestor.');
  for (const name of ['src', 'public', 'node_modules', '.git']) {
    if (contains(join(root, name), output)) throw new Error(`Export output must not be inside ${name}.`);
  }
  // Follow no output symlinks, including parent components: replacement must name the actual directory.
  for (let path = output; ; path = dirname(path)) {
    if ((await inspectPath(path))?.isSymbolicLink()) throw new Error(`Export output must not traverse a symlink: ${path}`);
    if (['node_modules', '.git'].includes(basename(path))) {
      throw new Error('Export output must not be inside node_modules or .git.');
    }
    if (dirname(path) === path) break;
  }
  const existing = await inspectPath(output);
  if (!existing) return;
  if (!existing.isDirectory()) throw new Error(`Export output is not a directory: ${output}`);
  if (!overwrite && (await readdir(output)).length) {
    throw new Error(`Output is not empty: ${output}. Use --overwrite to replace it after a successful build.`);
  }
}

function exportGuard(root: string, output: string, staging: string): Plugin {
  return {
    name: 'urk-web-export',
    enforce: 'post',
    async configResolved(config) {
      if (config.build.ssr || config.build.lib) {
        throw new Error('Web export requires a browser HTML build; SSR and library builds are not supported.');
      }
      if (resolve(config.root) !== root || resolve(config.root, config.build.outDir) !== staging ||
          !config.build.write || config.build.watch) {
        throw new Error('The Vite configuration must preserve the export root, temporary output, and one-shot writing.');
      }
      const outputs = config.build.rollupOptions.output;
      for (const options of Array.isArray(outputs) ? outputs : [outputs]) {
        if (!options) continue;
        if (options.file || (options.format && options.format !== 'es')) {
          throw new Error('Web export requires ES module browser output without rollupOptions.output.file.');
        }
        // Rollup output.dir overrides Vite outDir and can otherwise empty an unrelated directory.
        options.dir = staging;
      }
      if (config.publicDir) {
        const publicPath = await realpath(config.publicDir).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return resolve(config.publicDir);
          throw error;
        });
        if (contains(publicPath, output) || contains(output, publicPath)) {
          throw new Error('Export output must not overlap the configured public directory.');
        }
      }
    },
    async buildEnd(error) {
      if (error) return;
      // Include imported sources/assets and config dependencies, not just conventional src folders.
      for (const file of this.getWatchFiles()) {
        const path = file.split('?')[0];
        if (!isAbsolute(path)) continue;
        const source = await realpath(path).catch(() => path);
        if (contains(output, source)) throw new Error(`Export output contains a build input: ${source}`);
      }
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue;
        for (const dependency of [...item.imports, ...item.dynamicImports]) {
          if (!(dependency in bundle)) {
            throw new Error(`Web export cannot leave an external module dependency: ${dependency}. Bundle it in your Vite configuration.`);
          }
        }
      }
    },
  };
}

async function publishOutput(staging: string, output: string): Promise<void> {
  const backup = `${staging}-previous`;
  const hadOutput = Boolean(await inspectPath(output));
  if (hadOutput) await rename(output, backup);
  try {
    await rename(staging, output);
  } catch (error) {
    if (hadOutput) {
      try {
        await rename(backup, output);
      } catch {
        throw new Error(`Could not publish export or restore the destination. Previous output is preserved at ${backup}. ${String(error)}`);
      }
    }
    throw error;
  }
  if (hadOutput) await rm(backup, { recursive: true, force: true });
}

export async function runExportCommand(args: string[]): Promise<number> {
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(HELP);
    return 0;
  }
  const options = parseOptions(args);
  const root = await realpath(resolve(options.directory));
  if (!(await stat(root)).isDirectory()) throw new Error(`Project is not a directory: ${root}`);
  const entry = join(root, 'index.html');
  if (!(await inspectPath(entry))?.isFile()) throw new Error(`Web export requires index.html in ${root}.`);
  const output = resolve(root, options.outDir);
  await checkDestination(root, output, options.overwrite);
  await mkdir(dirname(output), { recursive: true });
  const staging = await mkdtemp(join(dirname(output), '.urk-export-'));
  try {
    // Load the existing bundler only for export; other CLI commands remain lightweight.
    const { build } = await import('vite');
    await build({
      root,
      base: options.base,
      mode: 'production',
      plugins: [exportGuard(root, output, staging)],
      build: { outDir: staging, emptyOutDir: true, write: true, watch: null, copyPublicDir: true },
    });
    if (!(await inspectPath(join(staging, 'index.html')))?.isFile()) {
      throw new Error('The Vite build did not emit index.html. Include it in your browser build entrypoints.');
    }
    await checkDestination(root, output, options.overwrite);
    await publishOutput(staging, output);
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  success(`Exported static web experience to ${output}`);
  info('Upload the whole directory to a static HTTP host and embed its index.html URL in an iframe.');
  return 0;
}
