/**
 * Company: EonHive Inc.
 * Title: Create Proof Command
 * Purpose: Scaffold repo-only URK proof routes inside the examples workspace.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { dirname, join, resolve } from 'node:path';
import { createProofTemplate } from '../templates/create-proof.js';
import { ensureDir, pathExists, readJsonFile, readTextFile, writeFile } from '../utils/fs.js';
import { error, success } from '../utils/logger.js';
import { validateProjectName } from '../utils/names.js';

type RootPackageJson = {
  name?: string;
  workspaces?: unknown;
};

const EXAMPLE_ENTRY_MARKER = '  // URK CLI: example entries';
const EXAMPLE_ROUTE_MARKER = '        // URK CLI: example routes';

async function isDirectoryEmpty(path: string): Promise<boolean> {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(path);
  return entries.length === 0;
}

async function findRepoRoot(startDirectory: string): Promise<string | null> {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    const packageJsonPath = join(currentDirectory, 'package.json');

    if (await pathExists(packageJsonPath)) {
      const manifest = await readJsonFile<RootPackageJson>(packageJsonPath);

      if (
        manifest.name === 'urk' &&
        (await pathExists(join(currentDirectory, 'examples', 'package.json')))
      ) {
        return currentDirectory;
      }
    }

    const parentDirectory = dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

function createExampleEntry(name: string): string {
  const title = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

  const routeTitle = /\bproof$/i.test(title) ? title : `${title} Proof`;

  return `  {
    id: '${name}',
    preview: 'generated',
    title: '${routeTitle}',
    category: 'Generated Proof',
    description:
      'A DOM-first generated proof scaffold with staged loading, one small controller, and lightweight overlay feedback.',
    routeHref: './${name}/',
    routeLabel: '/${name}/',
    tags: ['loading', 'input', 'ui-widgets'],
  },`;
}

function insertBeforeMarker(content: string, marker: string, block: string): string {
  if (!content.includes(marker)) {
    throw new Error(`Missing required marker: ${marker}`);
  }

  if (content.includes(block)) {
    return content;
  }

  return content.replace(marker, `${block}\n${marker}`);
}

export async function runCreateProofCommand(args: string[]): Promise<number> {
  const [name, ...rest] = args;

  if (!name || rest.length > 0) {
    error('Usage: urk create-proof <name>.');
    return 1;
  }

  try {
    validateProjectName(name);
  } catch (validationError) {
    error(validationError instanceof Error ? validationError.message : 'Invalid proof name.');
    return 1;
  }

  const repoRoot = await findRepoRoot(process.cwd());

  if (!repoRoot) {
    error('Could not find the URK repo root. The create-proof command only works inside this monorepo.');
    return 1;
  }

  const proofDirectory = join(repoRoot, 'examples', name);

  if (await pathExists(proofDirectory)) {
    if (!(await isDirectoryEmpty(proofDirectory))) {
      error(`Refusing to overwrite non-empty proof directory: examples/${name}`);
      return 1;
    }
  }

  const examplesMainPath = join(repoRoot, 'examples', 'main.ts');
  const viteConfigPath = join(repoRoot, 'examples', 'vite.config.ts');
  const examplesMain = await readTextFile(examplesMainPath);
  const viteConfig = await readTextFile(viteConfigPath);

  const nextExamplesMain = insertBeforeMarker(
    examplesMain,
    EXAMPLE_ENTRY_MARKER,
    createExampleEntry(name),
  );
  const nextViteConfig = insertBeforeMarker(
    viteConfig,
    EXAMPLE_ROUTE_MARKER,
    `        resolve(__dirname, '${name}/index.html'),`,
  );

  await ensureDir(proofDirectory);

  const files = createProofTemplate({ name });

  for (const [relativePath, content] of Object.entries(files)) {
    await writeFile(join(proofDirectory, relativePath), content);
  }

  await writeFile(examplesMainPath, nextExamplesMain);
  await writeFile(viteConfigPath, nextViteConfig);

  success(`Created repo-only proof at examples/${name}.`);
  process.stdout.write(`Route: /${name}/\n`);
  return 0;
}
