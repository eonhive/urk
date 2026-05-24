/**
 * Company: EonHive Inc.
 * Title: Check Command
 * Purpose: Validate basic URK package, runtime, boundary, and example rules.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-05
 * Notes: Vibe coded with Codex.
 */

import { readdir } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { pathExists } from '../utils/fs.js';
import { error } from '../utils/logger.js';
import {
  createProjectScanContext,
  formatRelativePath,
  getAllSourceFiles,
  getFilesMatching,
  isCliToolingFile,
  readProjectManifest,
  type CliPackageJsonValue,
  type ProjectScanContext,
  type ScannedSourceFile,
} from '../utils/source-scan.js';

type CheckStatus = 'PASS' | 'WARN' | 'FAIL';

type CheckResult = {
  status: CheckStatus;
  message: string;
};

const EXAMPLE_PROOF_IGNORES = new Set(['dist', 'node_modules', 'public']);
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const REQUIRED_PACKAGES = [
  {
    packageName: '@urk/core',
    label: '@urk/core',
    importPattern: /from ['"]@urk\/core['"]|import\(['"]@urk\/core['"]\)/,
  },
  {
    packageName: '@urk/adapters',
    label: '@urk/adapters',
    importPattern:
      /from ['"]@urk\/adapters(?:\/dom)?['"]|import\(['"]@urk\/adapters(?:\/dom)?['"]\)/,
  },
  {
    packageName: '@urk/react-urk',
    label: '@urk/react-urk',
    importPattern: /from ['"]@urk\/react-urk['"]|import\(['"]@urk\/react-urk['"]\)/,
  },
  {
    packageName: '@urk/next-urk',
    label: '@urk/next-urk',
    importPattern: /from ['"]@urk\/next-urk['"]|import\(['"]@urk\/next-urk['"]\)/,
  },
] as const;

const BOUNDARY_TERMS = [
  'Kivatar',
  'avatar pack',
  'soul seed',
  'monetization',
  'dashboard',
  'identity policy',
  'memory policy',
  'guide system',
  'marketplace',
  'cloud auth',
];

function hasDependency(manifest: CliPackageJsonValue, packageName: string): boolean {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].some((dependencies) => Boolean(dependencies?.[packageName]));
}

async function runPackageChecks(context: ProjectScanContext): Promise<CheckResult[]> {
  const results: CheckResult[] = [
    {
      status: 'PASS',
      message: `package.json found at ${formatRelativePath(process.cwd(), context.packageJsonPath)}.`,
    },
  ];

  for (const packageRoot of context.packageRoots) {
    const manifest = await readProjectManifest(packageRoot);
    const files = context.sourceFilesByRoot.get(packageRoot) ?? [];
    const packageLabel = manifest.name ?? formatRelativePath(context.packageRoot, packageRoot);

    for (const requiredPackage of REQUIRED_PACKAGES) {
      const importMatches = getFilesMatching(files, requiredPackage.importPattern);

      if (importMatches.length === 0) {
        continue;
      }

      if (hasDependency(manifest, requiredPackage.packageName)) {
        results.push({
          status: 'PASS',
          message: `${packageLabel} imports ${requiredPackage.label} and declares it in package.json.`,
        });
        continue;
      }

      results.push({
        status: 'FAIL',
        message: `${packageLabel} imports ${requiredPackage.label} but does not declare ${requiredPackage.packageName} in package.json.`,
      });
    }
  }

  return results;
}

function runRuntimeChecks(context: ProjectScanContext): CheckResult[] {
  const files = getAllSourceFiles(context).filter((file) => !isCliToolingFile(file));
  const createKernelFiles = files.filter((file) => /\bcreateKernel\b/.test(file.content));
  const bootFiles = files.filter((file) => /\bkernel\s*\.\s*boot\s*\(/.test(file.content));
  const results: CheckResult[] = [];

  if (createKernelFiles.length > 0) {
    results.push({
      status: 'PASS',
      message: `Found createKernel in ${createKernelFiles.length} source file(s).`,
    });
  } else {
    results.push({
      status: 'WARN',
      message: 'No createKernel usage found in common source folders.',
    });
  }

  if (bootFiles.length > 0) {
    results.push({
      status: 'PASS',
      message: `Found kernel.boot() in ${bootFiles.length} source file(s).`,
    });
  } else if (createKernelFiles.length > 0) {
    results.push({
      status: 'WARN',
      message: 'createKernel is present, but kernel.boot() was not found.',
    });
  } else {
    results.push({
      status: 'WARN',
      message: 'No kernel.boot() call found in common source folders.',
    });
  }

  const frameworkRuntimeFiles = files.filter((file) => {
    const importsWrapper =
      /@urk\/react-urk|@urk\/next-urk/.test(file.content) ||
      /from ['"]react['"]|from ['"]next\//.test(file.content);
    const importsUrkWrapper = /@urk\/react-urk|@urk\/next-urk/.test(file.content);
    const createsKernel = /\bcreateKernel\s*\(/.test(file.content);
    const providerWithoutKernelFactory =
      /<UrkProvider\b/.test(file.content) && !/<UrkProvider[\s\S]*?kernel=/.test(file.content);
    const nextProviderWithoutFactory =
      /<UrkNextProvider\b/.test(file.content) &&
      !/<UrkNextProvider[\s\S]*?createKernel=/.test(file.content);
    const wrapperCreatesKernelWithoutBoundary =
      importsUrkWrapper &&
      createsKernel &&
      !/<UrkProvider[\s\S]*?kernel=|<UrkNextProvider[\s\S]*?createKernel=|useClientKernel\s*\(/.test(
        file.content,
      );

    return (
      importsWrapper &&
      (providerWithoutKernelFactory || nextProviderWithoutFactory || wrapperCreatesKernelWithoutBoundary)
    );
  });

  if (frameworkRuntimeFiles.length > 0) {
    results.push({
      status: 'WARN',
      message:
        'React or Next files appear to own runtime creation; wrappers should consume an existing kernel unless this is an intentional client-boundary factory.',
    });
  } else {
    results.push({
      status: 'PASS',
      message: 'No obvious React or Next runtime ownership issue found.',
    });
  }

  return results;
}

function normalizeBoundaryText(content: string): string {
  return content.toLowerCase().replace(/[-_:]+/g, ' ');
}

function shouldScanBoundaryFile(file: ScannedSourceFile): boolean {
  const extension = extname(file.relativePath);

  if (file.absolutePath.endsWith('/packages/cli/src/commands/check.ts')) {
    return false;
  }

  return SOURCE_EXTENSIONS.has(extension);
}

function runBoundaryChecks(context: ProjectScanContext): CheckResult[] {
  const results: CheckResult[] = [];
  const packageRoots = context.isRepoRoot
    ? context.packageRoots.filter((root) => relative(context.packageRoot, root).startsWith('packages'))
    : context.packageRoots;
  const warnings: string[] = [];

  for (const packageRoot of packageRoots) {
    const files = context.sourceFilesByRoot.get(packageRoot) ?? [];

    for (const file of files) {
      if (!shouldScanBoundaryFile(file)) {
        continue;
      }

      const normalizedContent = normalizeBoundaryText(file.content);

      for (const term of BOUNDARY_TERMS) {
        if (normalizedContent.includes(normalizeBoundaryText(term))) {
          warnings.push(
            `${formatRelativePath(context.packageRoot, file.absolutePath)} contains "${term}".`,
          );
        }
      }
    }
  }

  if (warnings.length === 0) {
    return [
      {
        status: 'PASS',
        message: 'No product-specific boundary terms found in scanned URK package source files.',
      },
    ];
  }

  for (const warning of warnings) {
    results.push({
      status: 'WARN',
      message: warning,
    });
  }

  return results;
}

async function runExampleChecks(context: ProjectScanContext): Promise<CheckResult[]> {
  if (!context.isRepoRoot) {
    return [
      {
        status: 'PASS',
        message: 'Examples check skipped outside the URK repo root.',
      },
    ];
  }

  const examplesRoot = join(context.packageRoot, 'examples');

  if (!(await pathExists(examplesRoot))) {
    return [
      {
        status: 'WARN',
        message: 'examples/ folder was not found.',
      },
    ];
  }

  const entries = await readdir(examplesRoot, { withFileTypes: true });
  const proofDirectories = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith('.') &&
        !EXAMPLE_PROOF_IGNORES.has(entry.name),
    )
    .map((entry) => join(examplesRoot, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (proofDirectories.length === 0) {
    return [
      {
        status: 'WARN',
        message: 'No examples/* proof folders found.',
      },
    ];
  }

  const results: CheckResult[] = [];

  for (const proofDirectory of proofDirectories) {
    const missingFiles: string[] = [];

    for (const fileName of ['README.md', 'index.html', 'styles.css']) {
      if (!(await pathExists(join(proofDirectory, fileName)))) {
        missingFiles.push(fileName);
      }
    }

    const hasMainTs = await pathExists(join(proofDirectory, 'main.ts'));
    const hasMainTsx = await pathExists(join(proofDirectory, 'main.tsx'));

    if (!hasMainTs && !hasMainTsx) {
      missingFiles.push('main.ts or main.tsx');
    }

    if (missingFiles.length > 0) {
      results.push({
        status: 'WARN',
        message: `${formatRelativePath(context.packageRoot, proofDirectory)} is missing ${missingFiles.join(', ')}.`,
      });
      continue;
    }

    results.push({
      status: 'PASS',
      message: `${formatRelativePath(context.packageRoot, proofDirectory)} has the required proof files.`,
    });
  }

  return results;
}

function printGroup(title: string, results: CheckResult[]): void {
  process.stdout.write(`${title}\n`);

  for (const result of results) {
    process.stdout.write(`  ${result.status} ${result.message}\n`);
  }
}

export async function runCheckCommand(args: string[]): Promise<number> {
  if (args.length > 0) {
    error('Usage: urk check.');
    return 1;
  }

  const context = await createProjectScanContext(process.cwd());

  if (!context) {
    printGroup('Package', [
      {
        status: 'FAIL',
        message: 'package.json was not found in the current directory or any parent directory.',
      },
    ]);
    return 1;
  }

  const packageResults = await runPackageChecks(context);
  const runtimeResults = runRuntimeChecks(context);
  const boundaryResults = runBoundaryChecks(context);
  const exampleResults = await runExampleChecks(context);
  const allResults = [
    ...packageResults,
    ...runtimeResults,
    ...boundaryResults,
    ...exampleResults,
  ];

  printGroup('Package', packageResults);
  printGroup('Runtime', runtimeResults);
  printGroup('Boundary', boundaryResults);
  printGroup('Examples', exampleResults);

  return allResults.some((result) => result.status === 'FAIL') ? 1 : 0;
}
