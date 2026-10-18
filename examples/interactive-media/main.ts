/**
 * Company: EonHive Inc. | Title: Standalone Interactive Media Host
 * Purpose: Mount the shared proof and release it across page navigation and development reloads.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */
import { mountInteractiveMedia } from '@urk/examples/interactive-media';

const host = document.querySelector<HTMLElement>('#app')!;
let proof: ReturnType<typeof mountInteractiveMedia> | undefined = mountInteractiveMedia(host);
let cleanup = Promise.resolve();
let generation = 0;
const stop = () => {
  generation++;
  const current = proof;
  proof = undefined;
  if (current) cleanup = current.teardown();
};
const start = () => {
  const next = ++generation;
  void cleanup
    .then(() => {
      if (!proof && next === generation) proof = mountInteractiveMedia(host);
    })
    .catch((error) => {
      host.textContent = `Interactive media cleanup failed: ${String(error)}`;
    });
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', start);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('pageshow', start);
    stop();
  });
