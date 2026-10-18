/**
 * Company: EonHive Inc.
 * Title: Create Command
 * Purpose: Scaffold the first standalone URK browser runtime project.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createControllerTemplate } from '../templates/controller.js';
import { createProjectTemplate } from '../templates/create.js';
import { ensureDir, pathExists, readJsonFile, writeFile, writeJsonFile } from '../utils/fs.js';
import { error, info, success } from '../utils/logger.js';
import { validateProjectName } from '../utils/names.js';
import { detectUrkPackages, readNearestPackageJson } from '../utils/project.js';

type DependencyVersions = {
  cli: string;
  core: string;
  adapters: string;
  typescript: string;
  vite: string;
  packageManager?: string;
};

async function isDirectoryEmpty(path: string): Promise<boolean> {
  const entries = await readdir(path);
  return entries.length === 0;
}

async function resolveDependencyVersions(): Promise<DependencyVersions> {
  // This path works in both the source tree and an installed CLI package.
  const manifestPath = fileURLToPath(new URL('../../package.json', import.meta.url));
  const manifest = await readJsonFile<{
    version?: string;
    urkTemplateVersions?: Omit<DependencyVersions, 'cli'>;
  }>(manifestPath);
  const versions = manifest.urkTemplateVersions;
  if (!manifest.version || !versions?.core || !versions.adapters || !versions.typescript || !versions.vite) {
    throw new Error('The CLI package is missing its scaffold dependency versions.');
  }
  return { ...versions, cli: `^${manifest.version}` };
}

async function runCreateControllerCommand(args: string[]): Promise<number> {
  const [name, ...rest] = args;

  if (!name || rest.length > 0) {
    error('Usage: urk create controller <name>.');
    return 1;
  }

  try {
    validateProjectName(name);
  } catch (validationError) {
    error(validationError instanceof Error ? validationError.message : 'Invalid controller name.');
    return 1;
  }

  const nearestPackageJson = await readNearestPackageJson(process.cwd());

  if (!nearestPackageJson) {
    error('Could not find a package.json in the current directory or any parent directory.');
    return 1;
  }

  const packageRoot = dirname(nearestPackageJson.path);
  const detectedPackages = await detectUrkPackages(packageRoot);

  if (!detectedPackages.core) {
    error('The nearest package does not look like a URK project. Expected @urk/core in package.json.');
    return 1;
  }

  const template = createControllerTemplate({ name });
  const targetPath = join(packageRoot, 'src', 'controllers', template.fileName);

  if (await pathExists(targetPath)) {
    error(`Refusing to overwrite existing controller file: src/controllers/${template.fileName}`);
    return 1;
  }

  await writeFile(targetPath, template.content);

  success(`Created controller file src/controllers/${template.fileName}.`);
  info('Manual kernel wiring:');
  process.stdout.write(`  import { ${template.exportName} } from './controllers/${name}.controller';
  Add ${template.exportName} to the controllers array in src/kernel.ts.
`);
  return 0;
}

export async function runCreateCommand(args: string[]): Promise<number> {
  if (args[0] === 'controller') {
    return runCreateControllerCommand(args.slice(1));
  }

  const [name, ...rest] = args;

  if (!name || rest.length > 0) {
    error('Usage: urk create <name>.');
    return 1;
  }

  try {
    validateProjectName(name);
  } catch (validationError) {
    error(validationError instanceof Error ? validationError.message : 'Invalid project name.');
    return 1;
  }

  const targetDirectory = resolve(process.cwd(), name);

  if (await pathExists(targetDirectory)) {
    if (!(await isDirectoryEmpty(targetDirectory))) {
      error(`Refusing to overwrite non-empty directory: ${name}`);
      return 1;
    }
  } else {
    await ensureDir(targetDirectory);
  }

  const dependencyVersions = await resolveDependencyVersions();
  const template = createProjectTemplate({
    name,
    packageManager: dependencyVersions.packageManager,
    dependencyVersions,
  });

  await writeJsonFile(join(targetDirectory, 'package.json'), template.packageJson);

  for (const [relativePath, content] of Object.entries(template.files)) {
    await writeFile(join(targetDirectory, relativePath), content);
  }

  success(`Created standalone URK app in ${name}.`);
  process.stdout.write(`Next steps:
  cd ${name}
  corepack enable
  yarn install
  yarn dev
`);
  return 0;
}
