/**
 * Company: EonHive Inc.
 * Title: Scene UI Bridge Mount
 * Purpose: Mount the public URK example that coordinates scene state with User Interface overlay state.
 * Author: Stan Nesi
 * Created: 2026-05-08
 * Updated: 2026-05-08
 * Notes: Vibe coded with Codex.
 */

import type { ExampleMountOptions } from '../types.js';
import { mountSelectionProof } from '../selection-details/mount.js';

export function mountSceneUiBridgeExample(host: HTMLElement, _options: ExampleMountOptions = {}) {
  return mountSelectionProof(host, 'scene');
}
