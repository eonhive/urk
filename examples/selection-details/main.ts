/**
 * Company: EonHive Inc.
 * Title: Selection Proof Host
 * Purpose: Mount and independently dispose the two shared selection examples.
 * Author: Stan Nesi
 * Created: 2026-10-15
 * Updated: 2026-10-15
 * Notes: Vibe coded with Codex.
 */

import { mountSelectionProof } from '@urk/examples/selection-details';

const bindings: Array<{ stop(): void; start(): void; dispose(): void }> = [];
for (const mode of ['scene', 'projects'] as const) {
  const host = document.querySelector<HTMLElement>(`[data-proof="${mode}"]`)!;
  const button = document.querySelector<HTMLButtonElement>(`[data-unmount="${mode}"]`)!;
  let proof: ReturnType<typeof mountSelectionProof> | undefined;
  let cleanup = Promise.resolve();
  let generation = 0;
  let removed = false;
  const stop = (): void => {
    generation++;
    const current = proof;
    proof = undefined;
    if (current) cleanup = current.teardown();
  };
  const start = (): void => {
    if (proof || removed) return;
    const next = ++generation;
    void cleanup.then(() => {
      if (next === generation && !removed) proof = mountSelectionProof(host, mode);
    }).catch(() => { host.textContent = 'Cleanup failed. Reload this page.'; });
  };
  const unmount = (): void => {
    removed = true;
    button.disabled = true;
    stop();
    void cleanup.catch(() => { host.textContent = 'Cleanup failed. Reload this page.'; });
  };
  button.addEventListener('click', unmount);
  bindings.push({ stop, start, dispose() { button.removeEventListener('click', unmount); unmount(); } });
  start();
}
const stop = (): void => { for (const binding of bindings) binding.stop(); };
const start = (): void => { for (const binding of bindings) binding.start(); };
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', start);
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('pagehide', stop);
  window.removeEventListener('pageshow', start);
  for (const binding of bindings) binding.dispose();
});
