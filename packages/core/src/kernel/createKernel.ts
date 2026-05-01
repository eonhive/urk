/**
 * Company: EonHive Inc.
 * Title: Create Kernel
 * Purpose: Provide the canonical factory helper for constructing URK kernel instances.
 * Author: Stan Nesi
 * Created: 2026-05-01
 * Updated: 2026-05-01
 * Notes: Vibe coded with Codex.
 */

import { Kernel } from './Kernel.js';
import type { KernelConfig } from '../types.js';

export function createKernel(config: KernelConfig = {}): Kernel {
  return new Kernel(config);
}
