/**
 * Company: EonHive Inc.
 * Title: Inspect Command
 * Purpose: Print a static URK project inspection report without connecting to any live runtime surface.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import { readdir } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { pathExists, readTextFile } from '../utils/fs.js';
import { error } from '../utils/logger.js';
import { findPackageJson } from '../utils/project.js';
import {
  findWorkspacePackageRoots,
  formatRelativePath,
  readProjectManifest,
  stripTemplateLiterals,
  type CliPackageJsonValue,
} from '../utils/source-scan.js';

type InspectedSourceFile = {
  absolutePath: string;
  relativePath: string;
  content: string;
};

type UrkPackageName =
  | '@urk/core'
  | '@urk/adapters'
  | '@urk/react-urk'
  | '@urk/next-urk';

type AdapterDetection = {
  label: string;
  pattern: RegExp;
};

const HELP_TEXT = `Usage:
  urk inspect

Notes:
  Static project inspection only.
  This command does not connect to a browser runtime.
  Live runtime state requires browser runtime integration.
`;

const SOURCE_FOLDERS = ['src', 'app', 'examples'] as const;
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.yarn',
  'coverage',
  'dist',
  'node_modules',
  'public',
]);
const URK_PACKAGES: readonly UrkPackageName[] = [
  '@urk/core',
  '@urk/adapters',
  '@urk/react-urk',
  '@urk/next-urk',
];
const ADAPTER_DETECTIONS: readonly AdapterDetection[] = [
  { label: 'pointer', pattern: /\bcreatePointerAdapter\b/ },
  { label: 'input', pattern: /\bcreateInputAdapter\b/ },
  { label: 'loading', pattern: /\bcreateLoadingAdapter\b/ },
  { label: 'storage', pattern: /\bcreateStorageAdapter\b/ },
  { label: 'ui-widgets', pattern: /\bcreateUiWidgetsAdapter\b/ },
];

function printHelp(): void {
  process.stdout.write(`${HELP_TEXT}\n`);
}

function hasDependency(manifest: CliPackageJsonValue, packageName: string): boolean {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].some((dependencies) => Boolean(dependencies?.[packageName]));
}

async function collectInspectFiles(projectRoot: string): Promise<{
  files: InspectedSourceFile[];
  searchedFolders: string[];
}> {
  const files: InspectedSourceFile[] = [];
  const searchedFolders: string[] = [];

  async function visit(rootDirectory: string, directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          await visit(rootDirectory, absolutePath);
        }

        continue;
      }

      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) {
        continue;
      }

      files.push({
        absolutePath,
        relativePath: formatRelativePath(projectRoot, absolutePath),
        content: stripTemplateLiterals(await readTextFile(absolutePath)),
      });
    }
  }

  for (const folderName of SOURCE_FOLDERS) {
    const sourceDirectory = join(projectRoot, folderName);

    if (!(await pathExists(sourceDirectory))) {
      continue;
    }

    searchedFolders.push(folderName);
    await visit(projectRoot, sourceDirectory);
  }

  return {
    files,
    searchedFolders,
  };
}

async function detectInstalledPackages(
  projectRoot: string,
  manifest: CliPackageJsonValue,
): Promise<Record<UrkPackageName, boolean>> {
  const detections = Object.fromEntries(
    URK_PACKAGES.map((packageName) => [packageName, hasDependency(manifest, packageName)]),
  ) as Record<UrkPackageName, boolean>;

  if (!(Array.isArray(manifest.workspaces) && manifest.name === 'urk')) {
    return detections;
  }

  const workspaceRoots = await findWorkspacePackageRoots(projectRoot, true);

  for (const workspaceRoot of workspaceRoots) {
    const workspaceManifest = await readProjectManifest(workspaceRoot);
    const workspaceName = workspaceManifest.name;

    if (!workspaceName) {
      continue;
    }

    if (URK_PACKAGES.includes(workspaceName as UrkPackageName)) {
      detections[workspaceName as UrkPackageName] = true;
    }
  }

  return detections;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function listFilesMatching(files: InspectedSourceFile[], pattern: RegExp): string[] {
  return uniqueSorted(
    files.filter((file) => pattern.test(file.content)).map((file) => file.relativePath),
  );
}

function detectAdapters(files: InspectedSourceFile[]): string[] {
  const adapters = new Set<string>();

  for (const file of files) {
    for (const detection of ADAPTER_DETECTIONS) {
      if (detection.pattern.test(file.content)) {
        adapters.add(detection.label);
      }
    }
  }

  return uniqueSorted(adapters);
}

function detectControllerFiles(files: InspectedSourceFile[]): string[] {
  return uniqueSorted(
    files
      .filter((file) => {
        if (file.relativePath.includes('/controllers/')) {
          return true;
        }

        if (/\.controller\.[a-z]+$/i.test(file.relativePath)) {
          return true;
        }

        return (
          /\bControllerRegistration\b/.test(file.content) ||
          /\bexport\s+(?:const|function)\s+[A-Za-z0-9_]*Controller\b/.test(file.content) ||
          /\bexport\s*\{[^}]*Controller[^}]*\}/.test(file.content)
        );
      })
      .map((file) => file.relativePath),
  );
}

function printSection(title: string): void {
  process.stdout.write(`${title}\n`);
}

function printKeyValue(label: string, value: string): void {
  process.stdout.write(`  ${label}: ${value}\n`);
}

function printListBlock(title: string, items: string[]): void {
  process.stdout.write(`  ${title}:\n`);

  if (items.length === 0) {
    process.stdout.write('    none\n');
    return;
  }

  for (const item of items) {
    process.stdout.write(`    ${item}\n`);
  }
}

export async function runInspectCommand(args: string[]): Promise<number> {
  if (args.length > 0) {
    if (args.length === 1 && (args[0] === '-h' || args[0] === '--help')) {
      printHelp();
      return 0;
    }

    error('Usage: urk inspect.');
    printHelp();
    return 1;
  }

  const packageJsonPath = await findPackageJson(process.cwd());

  if (!packageJsonPath) {
    error('package.json was not found in the current directory or any parent directory.');
    return 1;
  }

  const projectRoot = dirname(packageJsonPath);
  const manifest = await readProjectManifest(projectRoot);
  const installedPackages = await detectInstalledPackages(projectRoot, manifest);
  const { files, searchedFolders } = await collectInspectFiles(projectRoot);
  const kernelFiles = listFilesMatching(files, /\bcreateKernel\s*\(/);
  const bootFiles = listFilesMatching(files, /\.\s*boot\s*\(/);
  const adapters = detectAdapters(files);
  const controllerFiles = detectControllerFiles(files);

  process.stdout.write('URK Project Inspection\n\n');

  printSection('Project:');
  printKeyValue('name', manifest.name ?? '(unnamed package)');
  printKeyValue('root', formatRelativePath(process.cwd(), projectRoot));
  printKeyValue('source folders', searchedFolders.length > 0 ? searchedFolders.join(', ') : 'none');
  process.stdout.write('\n');

  printSection('Packages:');

  for (const packageName of URK_PACKAGES) {
    printKeyValue(packageName, installedPackages[packageName] ? 'found' : 'not found');
  }

  process.stdout.write('\n');

  printSection('Runtime:');
  printListBlock('kernel files', kernelFiles);
  printListBlock('boot files', bootFiles);
  process.stdout.write('\n');

  printSection('Adapters:');

  if (adapters.length === 0) {
    process.stdout.write('  none\n');
  } else {
    for (const adapter of adapters) {
      process.stdout.write(`  ${adapter}\n`);
    }
  }

  process.stdout.write('\n');

  printSection('Controllers:');

  if (controllerFiles.length === 0) {
    process.stdout.write('  none\n');
  } else {
    for (const controllerFile of controllerFiles) {
      process.stdout.write(`  ${controllerFile}\n`);
    }
  }

  process.stdout.write('\n');

  printSection('Notes:');
  process.stdout.write(
    '  Static inspection only. Live runtime state requires browser runtime integration.\n',
  );

  return 0;
}
