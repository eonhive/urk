/**
 * Company: EonHive Inc.
 * Title: Site Metadata
 * Purpose: Hold canonical public website metadata and core brand lines for the URK site shell.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

export const siteMetadata = {
  title: 'URK',
  fullName: 'Universal Runtime Kernel',
  tagline: 'A tiny runtime for big ideas.',
  description:
    'URK is a public open-source runtime kernel for interactive browser experiences. Combine 3D, sound, input, and UI with a small TypeScript core and the framework you choose.',
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
