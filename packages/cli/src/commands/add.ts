/**
 * Company: EonHive Inc.
 * Title: Add Command
 * Purpose: Add supported DOM adapters to a local URK project's adapters file without guessing.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import { dirname, join } from 'node:path';
import {
  getSupportedAdapter,
  getSupportedAdapterNames,
  type SupportedAdapterDefinition,
} from '../utils/adapter-catalog.js';
import { pathExists, readTextFile, writeFile } from '../utils/fs.js';
import { success, warn } from '../utils/logger.js';
import { detectUrkPackages, readNearestPackageJson } from '../utils/project.js';

type UpdateResult =
  | { status: 'created'; content: string }
  | { status: 'updated'; content: string }
  | { status: 'unchanged'; content: string }
  | { status: 'unsupported'; reason: string };

const DOM_IMPORT_PATTERN = /import\s*\{([\s\S]*?)\}\s*from '@urk\/adapters\/dom';/;
const ADAPTERS_ARRAY_PATTERN =
  /(export const adapters(?:\s*:\s*Array<AdapterRegistration<unknown>>)?\s*=\s*\[)([\s\S]*?)(\n\];)/;
const CORE_IMPORT_PATTERN =
  /import type \{ AdapterRegistration \} from '@urk\/core';\n?/;

function printUsage(): void {
  warn(
    `Usage: urk add adapter <name>. Supported adapters: ${getSupportedAdapterNames().join(', ')}`,
  );
}

function formatDomImport(importNames: string[]): string {
  const sortedNames = [...new Set(importNames)].sort((left, right) =>
    left.localeCompare(right),
  );

  return `import {\n${sortedNames
    .map((importName) => `  ${importName},`)
    .join('\n')}\n} from '@urk/adapters/dom';`;
}

function createAdaptersFileContent(adapter: SupportedAdapterDefinition): string {
  return `/**
 * Company: EonHive Inc.
 * Title: App Adapters
 * Purpose: Keep the local URK adapter stack explicit and dependency-light.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

import type { AdapterRegistration } from '@urk/core';
${formatDomImport([adapter.importName])}

/**
 * An adapter exposes one browser capability to the kernel behind a small API. This file keeps
 * the runtime explicit by showing which DOM capabilities the project has chosen to register.
 */
export const adapters: Array<AdapterRegistration<unknown>> = [
  // ${adapter.comment}
  ${adapter.factoryCall},
];
`;
}

function updateDomImport(
  content: string,
  adapter: SupportedAdapterDefinition,
): UpdateResult {
  const importMatch = content.match(DOM_IMPORT_PATTERN);

  if (importMatch) {
    const existingImports = importMatch[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (existingImports.includes(adapter.importName)) {
      return { status: 'unchanged', content };
    }

    const nextImportBlock = formatDomImport([...existingImports, adapter.importName]);

    return {
      status: 'updated',
      content: content.replace(importMatch[0], nextImportBlock),
    };
  }

  const coreImportMatch = content.match(CORE_IMPORT_PATTERN);

  if (!coreImportMatch) {
    return {
      status: 'unsupported',
      reason:
        'src/adapters.ts does not contain the canonical AdapterRegistration import the CLI expects.',
    };
  }

  return {
    status: 'updated',
    content: content.replace(
      coreImportMatch[0],
      `${coreImportMatch[0]}${formatDomImport([adapter.importName])}\n`,
    ),
  };
}

function updateAdaptersArray(
  content: string,
  adapter: SupportedAdapterDefinition,
): UpdateResult {
  if (content.includes(adapter.factoryCall)) {
    return { status: 'unchanged', content };
  }

  const arrayMatch = content.match(ADAPTERS_ARRAY_PATTERN);

  if (!arrayMatch) {
    return {
      status: 'unsupported',
      reason:
        'src/adapters.ts does not contain the canonical exported adapters array the CLI expects.',
    };
  }

  const [, prefix, body, suffix] = arrayMatch;
  const trimmedBody = body.trimEnd();
  const nextBody =
    trimmedBody.length > 0
      ? `${trimmedBody}\n  // ${adapter.comment}\n  ${adapter.factoryCall},`
      : `\n  // ${adapter.comment}\n  ${adapter.factoryCall},`;

  return {
    status: 'updated',
    content: content.replace(arrayMatch[0], `${prefix}${nextBody}${suffix}`),
  };
}

function upsertAdapter(
  content: string,
  adapter: SupportedAdapterDefinition,
): UpdateResult {
  const importUpdate = updateDomImport(content, adapter);

  if (importUpdate.status === 'unsupported') {
    return importUpdate;
  }

  const arrayUpdate = updateAdaptersArray(importUpdate.content, adapter);

  if (arrayUpdate.status === 'unsupported') {
    return arrayUpdate;
  }

  if (
    importUpdate.status === 'unchanged' &&
    arrayUpdate.status === 'unchanged'
  ) {
    return { status: 'unchanged', content };
  }

  return {
    status: 'updated',
    content: arrayUpdate.content,
  };
}

export async function runAddCommand(args: string[]): Promise<number> {
  const [target, adapterName, ...extraArgs] = args;

  if (target !== 'adapter' || !adapterName || extraArgs.length > 0) {
    printUsage();
    return 1;
  }

  const adapter = getSupportedAdapter(adapterName);

  if (!adapter) {
    warn(
      `Unsupported adapter "${adapterName}". Supported adapters: ${getSupportedAdapterNames().join(', ')}`,
    );
    return 1;
  }

  const nearestPackageJson = await readNearestPackageJson(process.cwd());

  if (!nearestPackageJson) {
    warn('Could not find a package.json in the current directory or any parent directory.');
    return 1;
  }

  const packageRoot = dirname(nearestPackageJson.path);
  const detectedPackages = await detectUrkPackages(packageRoot);

  if (!detectedPackages.core || !detectedPackages.adapters) {
    warn(
      'The nearest package does not look like a standalone URK project. Expected @urk/core and @urk/adapters in package.json.',
    );
    return 1;
  }

  const adaptersFilePath = join(packageRoot, 'src', 'adapters.ts');

  if (!(await pathExists(adaptersFilePath))) {
    const content = createAdaptersFileContent(adapter);
    await writeFile(adaptersFilePath, content);
    success(`Created src/adapters.ts with the ${adapter.name} adapter.`);
    return 0;
  }

  const existingContent = await readTextFile(adaptersFilePath);
  const updateResult = upsertAdapter(existingContent, adapter);

  if (updateResult.status === 'unsupported') {
    warn(updateResult.reason);
    warn('The CLI did not modify src/adapters.ts because the file shape is not recognized safely.');
    return 1;
  }

  if (updateResult.status === 'unchanged') {
    success(`The ${adapter.name} adapter is already present in src/adapters.ts.`);
    return 0;
  }

  await writeFile(adaptersFilePath, updateResult.content);
  success(`Added the ${adapter.name} adapter to src/adapters.ts.`);
  return 0;
}
