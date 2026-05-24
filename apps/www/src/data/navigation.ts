/**
 * Company: EonHive Inc.
 * Title: Navigation Data
 * Purpose: Define the primary public navigation for the URK website shell.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import { siteMetadata } from './site.js';

export type NavigationItem = {
  label: string;
  href: string;
  external?: boolean;
};

export const primaryNavigation: NavigationItem[] = [
  { label: 'Docs', href: siteMetadata.docsPath },
  { label: 'Examples', href: siteMetadata.examplesPath },
  { label: 'Packages', href: siteMetadata.packagesPath },
  { label: 'Playground', href: siteMetadata.playgroundPath },
  { label: 'GitHub', href: siteMetadata.githubUrl, external: true },
];
