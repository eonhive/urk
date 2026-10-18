/**
 * Company: EonHive Inc. | Title: Orbit Experience Showcase
 * Purpose: Present the shared film-to-gallery experience through the existing host contract.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { mountInteractiveMedia } from '../interactive-media/mount.js';
export function mountExperienceShowcase(host: HTMLElement) {
  return mountInteractiveMedia(host, { mode: 'showcase' });
}
