/**
 * Company: EonHive Inc.
 * Title: Example Data
 * Purpose: Describe the public examples index while reusing real metadata from the URK examples workspace.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-14
 * Notes: Vibe coded with Codex.
 */

import { exampleCatalog } from '@urk/examples';
import type { ExampleStatus } from '@urk/examples';

export type ExampleIndexEntry = {
  title: string;
  href: string;
  summary: string;
  status: 'Current' | 'Experimental' | 'Planned';
  boundary: string;
  difficulty: 'Intro' | 'Intermediate' | 'Advanced';
  purpose: string;
};

function formatStatus(status: ExampleStatus): ExampleIndexEntry['status'] {
  if (status === 'current') {
    return 'Current';
  }

  if (status === 'experimental') {
    return 'Experimental';
  }

  return 'Planned';
}

function formatDifficulty(difficulty: 'intro' | 'intermediate' | 'advanced'): ExampleIndexEntry['difficulty'] {
  if (difficulty === 'intro') {
    return 'Intro';
  }

  if (difficulty === 'intermediate') {
    return 'Intermediate';
  }

  return 'Advanced';
}

const exampleIndexEntries: ExampleIndexEntry[] = exampleCatalog.map((example) => ({
  title: example.title,
  href: `/examples/${example.slug}`,
  summary: example.summary,
  status: formatStatus(example.status),
  boundary: example.boundary,
  difficulty: formatDifficulty(example.difficulty),
  purpose: example.purpose,
}));

export const liveExamples: ExampleIndexEntry[] = exampleIndexEntries.filter(
  (example) => example.status === 'Current',
);

export const nonCurrentExamples: ExampleIndexEntry[] = exampleIndexEntries.filter(
  (example) => example.status !== 'Current',
);
