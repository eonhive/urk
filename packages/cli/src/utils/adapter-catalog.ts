/**
 * Company: EonHive Inc.
 * Title: CLI Adapter Catalog
 * Purpose: Describe the supported DOM adapters the URK CLI can add safely in v0.
 * Author: Stan Nesi
 * Created: 2026-05-03
 * Updated: 2026-05-03
 * Notes: Vibe coded with Codex.
 */

export type SupportedAdapterName =
  | 'pointer'
  | 'input'
  | 'loading'
  | 'storage'
  | 'ui-widgets';

export type SupportedAdapterDefinition = {
  name: SupportedAdapterName;
  importName: string;
  factoryCall: string;
  comment: string;
};

/**
 * Keep the supported adapter surface explicit so the CLI never guesses at public factory names.
 */
export const SUPPORTED_ADAPTERS: Record<
  SupportedAdapterName,
  SupportedAdapterDefinition
> = {
  pointer: {
    name: 'pointer',
    importName: 'createPointerAdapter',
    factoryCall: 'createPointerAdapter()',
    comment: 'Normalizes pointer targets and surface interactions into runtime events.',
  },
  input: {
    name: 'input',
    importName: 'createInputAdapter',
    factoryCall: 'createInputAdapter()',
    comment: 'Normalizes browser keyboard input into one reusable runtime capability.',
  },
  loading: {
    name: 'loading',
    importName: 'createLoadingAdapter',
    factoryCall: 'createLoadingAdapter()',
    comment: 'Tracks staged loading progress so the runtime can move cleanly into ready.',
  },
  storage: {
    name: 'storage',
    importName: 'createStorageAdapter',
    factoryCall: 'createStorageAdapter()',
    comment: 'Exposes a small namespaced local and session storage capability.',
  },
  'ui-widgets': {
    name: 'ui-widgets',
    importName: 'createUiWidgetsAdapter',
    factoryCall: 'createUiWidgetsAdapter()',
    comment: 'Mounts a tiny overlay status and callout UI into the shared ui:host service.',
  },
};

/**
 * Return the supported adapter definition for a user-provided adapter name.
 * Unknown names resolve to null so commands can fail clearly without throwing deep in the edit path.
 */
export function getSupportedAdapter(
  name: string,
): SupportedAdapterDefinition | null {
  return SUPPORTED_ADAPTERS[name as SupportedAdapterName] ?? null;
}

/**
 * List the current v0 adapter names for usage text and validation messages.
 */
export function getSupportedAdapterNames(): SupportedAdapterName[] {
  return Object.keys(SUPPORTED_ADAPTERS) as SupportedAdapterName[];
}
