/**
 * Company: EonHive Inc.
 * Title: CLI Naming Helpers
 * Purpose: Normalize and validate simple project names for future URK scaffolds.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

function splitWords(input: string): string[] {
  return input
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean);
}

/**
 * Convert free-form text into lowercase kebab-case.
 * This is the safest default format for folders, routes, and package names.
 */
export function toKebabCase(input: string): string {
  return splitWords(input)
    .map((part) => part.toLowerCase())
    .join('-');
}

/**
 * Convert free-form text into lower camelCase.
 * This is useful for generated variable names and helper identifiers.
 */
export function toCamelCase(input: string): string {
  const pascalCase = toPascalCase(input);

  if (!pascalCase) {
    return '';
  }

  return pascalCase.charAt(0).toLowerCase() + pascalCase.slice(1);
}

/**
 * Convert free-form text into PascalCase.
 * This is useful for generated type names, component names, and controller identifiers.
 */
export function toPascalCase(input: string): string {
  return splitWords(input)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Validate that a project name is safe for predictable CLI scaffolding.
 * The initial CLI requires lowercase kebab-case to avoid path and naming ambiguity.
 */
export function validateProjectName(name: string): void {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error('Project name is required.');
  }

  if (trimmedName !== name) {
    throw new Error('Project names must not include leading or trailing whitespace.');
  }

  if (trimmedName.startsWith('.')) {
    throw new Error('Project names must not start with a dot.');
  }

  if (/[\\/]/.test(trimmedName)) {
    throw new Error('Project names must not include path separators.');
  }

  const kebabCaseName = toKebabCase(trimmedName);

  if (!kebabCaseName) {
    throw new Error('Project name must include letters or numbers.');
  }

  if (trimmedName !== kebabCaseName) {
    throw new Error('Project names must use lowercase kebab-case, for example "my-proof".');
  }
}
