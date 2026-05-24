/**
 * Company: EonHive Inc.
 * Title: Site Metadata
 * Purpose: Hold canonical public website metadata and core brand lines for the URK site shell.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

export const siteMetadata = {
  title: 'URK',
  fullName: 'Universal Runtime Kernel',
  tagline: 'The runtime kernel for interactive browser experiences.',
  description:
    'URK is a public open-source runtime kernel for interactive browser experiences. It stays standalone-first, adapter-based, controller-driven, and explicit about runtime state.',
  githubUrl: 'https://github.com/eonhive/urk',
  docsPath: '/docs',
  examplesPath: '/examples',
  packagesPath: '/packages',
  playgroundPath: '/playground',
  brandPath: '/brand',
} as const;

export const supportingLines = [
  'Runtime UI, without framework lock-in.',
  'Build interfaces from data.',
  'Data in. Experience out.',
  'Declarative layouts. Runtime execution. Interactive UI.',
] as const;
