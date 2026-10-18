/**
 * Company: EonHive Inc.
 * Title: Project Selection Metadata
 * Purpose: Describe the webpage reuse of the selection-details pattern.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import { sceneUiBridgeMeta } from '../scene-ui-bridge/meta.js';
import type { ExampleMeta } from '../types.js';

export const projectSelectionMeta: ExampleMeta = {
  ...sceneUiBridgeMeta,
  id: 'project-selection', slug: 'project-selection', title: 'Project Selection',
  purpose: 'Select a project and feature its card through a reusable details panel.',
  summary: 'An ordinary webpage reuses the Scene/UI Bridge selection pattern, with independent navigation and no scene renderer.',
  explanation: 'Project cards invoke the same cancellable details pattern as the scene example. Feature project changes the actual selected card. Page navigation stays outside the runtime. Details errors are local and retryable; closing a panel retains the selection.',
  nextExampleId: 'scene-ui-bridge',
};
