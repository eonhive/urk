/**
 * Company: EonHive Inc. | Title: Orbit Experience Showcase
 * Purpose: Present the shared film-to-gallery experience through the existing host contract.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { interactiveMediaMeta } from '../interactive-media/meta.js';
import type { ExampleMeta } from '../types.js';
export const experienceShowcaseMeta: ExampleMeta = {
  ...interactiveMediaMeta,
  id: 'experience-showcase', slug: 'experience-showcase', title: 'Experience Showcase',
  purpose: 'A film becomes a world. Step beyond the frame.',
  summary: 'An original film, timed titles, branching soundscapes, and a selectable 3D video gallery in one shared experience.',
  difficulty: 'advanced',
  adapters: ['video', 'audio/mixer', 'motion', 'storage', 'three'],
  teaches: ['Borrow a video handle for a scoped Three.js texture.', 'Render decoded frames without an idle loop.', 'Cancel gallery setup and recover without losing the film.'],
  boundary: 'Controllers compose media and a lazily acquired scene; the kernel and native video capability remain unchanged.',
  nextExampleId: 'interactive-media',
  sourceFiles: [{ path: 'packages/examples/src/interactive-media/gallery.ts', label: 'Owned video scene', language: 'ts', excerpt: `const binding = createVideoTexture(player, ctx);
const screen = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: binding.texture }));
// Decoded frames and user changes request a coalesced draw.` }],
};
