/**
 * Company: EonHive Inc.
 * Title: CLI Source Scan Helpers
 * Purpose: Share lightweight source scanning primitives across static CLI commands.
 * Author: Stan Nesi
 * Created: 2026-05-05
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { pathExists, readJsonFile, readTextFile } from './fs.js';
import { findPackageJson } from './project.js';

export type CliPackageJsonValue = {
  name?: string;
  private?: boolean;
  workspaces?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  [key: string]: unknown;
};

export type ScannedSourceFile = {
  absolutePath: string;
  relativePath: string;
  content: string;
};

export type ProjectScanContext = {
  currentDirectory: string;
  packageJsonPath: string;
  packageRoot: string;
  manifest: CliPackageJsonValue;
  isRepoRoot: boolean;
  packageRoots: string[];
  sourceFilesByRoot: Map<string, ScannedSourceFile[]>;
};

const SOURCE_DIRECTORIES = ['src', 'app', 'pages'];
const REPO_PACKAGE_DIRECTORIES = ['packages', 'apps', 'examples'];
const EXAMPLE_PROOF_IGNORES = new Set(['dist', 'node_modules', 'public']);
const ROOT_ENTRY_FILES = ['main.ts', 'main.tsx'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.next',
  '.turbo',
  '.yarn',
  'coverage',
  'dist',
  'node_modules',
]);

/**
 * Format a path relative to one known directory so CLI output stays compact and readable.
 */
export function formatRelativePath(fromDirectory: string, absolutePath: string): string {
  const relativePath = relative(fromDirectory, absolutePath);

  return relativePath || '.';
}

/**
 * Collect source files under the common runtime folders used by URK projects and proofs.
 * This keeps the CLI static and dependency-light while still giving commands enough context.
 */
export async function collectSourceFiles(root: string): Promise<ScannedSourceFile[]> {
  const files: ScannedSourceFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) {
          await visit(absolutePath);
        }

        continue;
      }

      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(extname(entry.name))) {
        continue;
      }

      files.push({
        absolutePath,
        relativePath: formatRelativePath(root, absolutePath),
        content: await readTextFile(absolutePath),
      });
    }
  }

  for (const fileName of ROOT_ENTRY_FILES) {
    const entryPath = join(root, fileName);

    if (!(await pathExists(entryPath))) {
      continue;
    }

    files.push({
      absolutePath: entryPath,
      relativePath: formatRelativePath(root, entryPath),
      content: await readTextFile(entryPath),
    });
  }

  for (const directoryName of SOURCE_DIRECTORIES) {
    const sourceDirectory = join(root, directoryName);

    if (await pathExists(sourceDirectory)) {
      await visit(sourceDirectory);
    }
  }

  if (basename(root) === 'examples') {
    const entries = await readdir(root, { withFileTypes: true });

    for (const entry of entries) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith('.') ||
        EXAMPLE_PROOF_IGNORES.has(entry.name)
      ) {
        continue;
      }

      await visit(join(root, entry.name));
    }
  }

  return files;
}

/**
 * Find workspace package roots when scanning the URK monorepo.
 * Non-repo projects return only their own package root.
 */
export async function findWorkspacePackageRoots(
  contextRoot: string,
  isRepoRoot: boolean,
): Promise<string[]> {
  if (!isRepoRoot) {
    return [contextRoot];
  }

  const roots = new Set<string>([contextRoot]);

  for (const directoryName of REPO_PACKAGE_DIRECTORIES) {
    const directoryPath = join(contextRoot, directoryName);

    if (!(await pathExists(directoryPath))) {
      continue;
    }

    const directoryStat = await stat(directoryPath);

    if (!directoryStat.isDirectory()) {
      continue;
    }

    const entries = await readdir(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidateRoot = join(directoryPath, entry.name);

      if (await pathExists(join(candidateRoot, 'package.json'))) {
        roots.add(candidateRoot);
      }
    }
  }

  return [...roots].sort((left, right) => left.localeCompare(right));
}

/**
 * Read one package manifest from disk using the shared CLI manifest shape.
 */
export async function readProjectManifest(root: string): Promise<CliPackageJsonValue> {
  return readJsonFile<CliPackageJsonValue>(join(root, 'package.json'));
}

/**
 * Build a scan context around the nearest package.json so static commands can inspect projects
 * from nested working directories without executing any runtime code.
 */
export async function createProjectScanContext(
  cwd: string,
): Promise<ProjectScanContext | null> {
  const packageJsonPath = await findPackageJson(cwd);

  if (!packageJsonPath) {
    return null;
  }

  const currentDirectory = resolve(cwd);
  const packageRoot = dirname(packageJsonPath);
  const manifest = await readProjectManifest(packageRoot);
  const isRepoRoot = manifest.name === 'urk' && Array.isArray(manifest.workspaces);
  const packageRoots = await findWorkspacePackageRoots(packageRoot, isRepoRoot);
  const sourceFilesByRoot = new Map<string, ScannedSourceFile[]>();

  for (const root of packageRoots) {
    sourceFilesByRoot.set(root, await collectSourceFiles(root));
  }

  return {
    currentDirectory,
    packageJsonPath,
    packageRoot,
    manifest,
    isRepoRoot,
    packageRoots,
    sourceFilesByRoot,
  };
}

/**
 * Flatten every scanned source file in a context into one list.
 * Commands use this when they need a project-wide or repo-wide summary.
 */
export function getAllSourceFiles(context: ProjectScanContext): ScannedSourceFile[] {
  return [...context.sourceFilesByRoot.values()].flat();
}

/**
 * Identify generated template files so static scans do not mistake scaffold text for runtime code.
 */
export function isGeneratedTemplateFile(file: ScannedSourceFile): boolean {
  return file.relativePath.split('/').includes('templates');
}

/**
 * Identify CLI implementation files so repo-wide runtime scans can exclude tooling source.
 * The CLI may mention runtime APIs in strings and docs, but it should not count as runtime code.
 */
export function isCliToolingFile(file: ScannedSourceFile): boolean {
  return file.absolutePath.includes('/packages/cli/');
}

/**
 * Remove template literal bodies before scanning raw source text.
 * This keeps generated string content from looking like real imports or runtime calls.
 */
export function stripTemplateLiterals(content: string): string {
  let stripped = '';
  let insideTemplate = false;
  let escaping = false;

  for (const character of content) {
    if (insideTemplate) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (character === '\\') {
        escaping = true;
        continue;
      }

      if (character === '`') {
        insideTemplate = false;
      }

      continue;
    }

    if (character === '`') {
      insideTemplate = true;
      continue;
    }

    stripped += character;
  }

  return stripped;
}

/**
 * Return scanned files whose non-template source matches a pattern.
 * Commands use this for conservative import and runtime heuristics.
 */
export function getFilesMatching(
  files: ScannedSourceFile[],
  pattern: RegExp,
): ScannedSourceFile[] {
  return files.filter(
    (file) => !isGeneratedTemplateFile(file) && pattern.test(stripTemplateLiterals(file.content)),
  );
}
