/**
 * Company: EonHive Inc.
 * Title: Example Types
 * Purpose: Define the internal unstable contract used by the public site to mount URK runtime examples.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

export type ExampleId =
  | 'minimal-runtime'
  | 'adapter-registration'
  | 'controller-orchestration'
  | 'runtime-state'
  | 'event-routing'
  | 'scene-ui-bridge'
  | 'pointer-input-overlay'
  | 'embedded-docs-demo';

export type ExampleDifficulty = 'intro' | 'intermediate' | 'advanced';
export type ExampleStatus = 'current' | 'experimental' | 'planned';

export type ExamplePanel =
  | 'source'
  | 'schema'
  | 'state'
  | 'events'
  | 'adapters'
  | 'preview';

export interface ExampleSourceFile {
  path: string;
  label: string;
  language: 'ts' | 'tsx' | 'json' | 'mdx' | 'css';
  excerpt: string;
}

export interface ExampleDocLink {
  title: string;
  href: string;
}

export interface ExampleMeta {
  id: ExampleId;
  slug: string;
  title: string;
  purpose: string;
  summary: string;
  difficulty: ExampleDifficulty;
  boundary: string;
  status: ExampleStatus;
  teaches: string[];
  adapters: string[];
  controllers: string[];
  panels: ExamplePanel[];
  schemaSource: string;
  sourceFiles: ExampleSourceFile[];
  explanation: string;
  relatedDocs: ExampleDocLink[];
  nextExampleId?: ExampleId;
}

export interface ExampleMountOptions {
  debug?: boolean;
  initialSchema?: unknown;
  initialState?: unknown;
}

export interface ExampleMountResult {
  teardown(): Promise<void> | void;
  restart?(): Promise<void> | void;
}

export interface ExampleModule {
  meta: ExampleMeta;
  mount(host: HTMLElement, options?: ExampleMountOptions): Promise<ExampleMountResult> | ExampleMountResult;
}
