/**
 * Company: EonHive Inc. | Title: Motion Embed Starter Exporter
 * Purpose: Copy the shared widget and pack current runtime builds into an independent project.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const json = async (path) => JSON.parse(await readFile(path, 'utf8'));

async function main() {
  const [destination, ...rest] = process.argv.slice(2);
  if (!destination || rest.length)
    throw new Error('Usage: node scripts/create-motion-starter.mjs <new-directory>');
  if (Number(process.versions.node.split('.')[0]) !== 22)
    throw new Error('Use Node 22 to export this starter.');
  const target = resolve(destination);
  try {
    await lstat(target);
    throw new Error(
      'Destination already exists. Choose a new directory; files are never overwritten.',
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await access(join(repo, 'packages/core/dist/index.js'));
    await access(join(repo, 'packages/adapters/dist/motion/index.js'));
  } catch {
    throw new Error('Build the runtime first: node scripts/build.mjs @urk/adapters');
  }
  const rootManifest = await json(join(repo, 'package.json'));
  const versions = (await json(join(repo, 'packages/cli/package.json'))).urkTemplateVersions;
  await mkdir(dirname(target), { recursive: true });
  const staging = await mkdtemp(join(dirname(target), '.urk-motion-starter-'));
  try {
    await mkdir(join(staging, 'widget'));
    await mkdir(join(staging, 'vendor'));
    for (const file of ['index.html', 'main.ts', 'styles.css', 'vite.config.js', 'README.md'])
      await copyFile(join(repo, 'examples/motion-starter', file), join(staging, file));
    for (const file of ['index.ts', 'timing.ts', 'styles.ts', 'preferences.ts', 'presets.ts'])
      await copyFile(
        join(repo, 'packages/examples/src/motion-widget', file),
        join(staging, 'widget', file),
      );
    const dependencies = {};
    for (const name of ['core', 'adapters']) {
      const archive = join(staging, 'vendor', `${name}.tgz`);
      execFileSync(
        'corepack',
        [
          'yarn',
          'workspace',
          `@urk/${name}`,
          'pack',
          '--out',
          archive,
        ],
        { cwd: repo, stdio: 'inherit' },
      );
      // Relative file dependencies need a new identity whenever archive contents change.
      const digest = createHash('sha256').update(await readFile(archive)).digest('hex');
      const filename = `${name}-${digest}.tgz`;
      await rename(archive, join(staging, 'vendor', filename));
      dependencies[`@urk/${name}`] = `file:./vendor/${filename}`;
    }
    const manifest = {
      name: 'urk-motion-starter',
      version: '0.1.0',
      private: true,
      type: 'module',
      packageManager: rootManifest.packageManager,
      engines: { node: '22.x' },
      scripts: {
        dev: 'vite --host 127.0.0.1',
        build: 'tsc --noEmit && vite build',
        preview: 'vite preview --host 127.0.0.1',
      },
      dependencies,
      devDependencies: { typescript: versions.typescript, vite: versions.vite },
    };
    const tsconfig = {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        types: ['vite/client'],
      },
      include: ['main.ts', 'widget/**/*.ts'],
    };
    await writeFile(join(staging, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
    await writeFile(join(staging, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2) + '\n');
    await writeFile(join(staging, '.yarnrc.yml'), 'nodeLinker: node-modules\n');
    // An independent lockfile keeps Yarn from treating a nested destination as a workspace member.
    await writeFile(join(staging, 'yarn.lock'), '');
    await writeFile(join(staging, '.gitignore'), 'node_modules/\ndist/\n.yarn/\n');
    await rename(staging, target);
    process.stdout.write(
      `Created ${target}\nRun in that directory: corepack yarn install, then corepack yarn dev\n`,
    );
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
