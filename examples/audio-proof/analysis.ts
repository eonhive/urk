/**
 * Company: EonHive Inc. | Title: Standalone Audio Lab Host
 * Purpose: Mount the same audio-reactive experience as the website and release it across navigation.
 * Author: Stan Nesi | Created: 2026-10-17 | Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { mountAudioProof } from '@urk/examples/audio-proof';

const host = document.querySelector<HTMLElement>('#app')!;
const options = { assetBaseUrl: new URL('../audio/', location.href).href };
let proof: ReturnType<typeof mountAudioProof> | undefined = mountAudioProof(host, options);
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
  void cleanup.then(() => {
    if (!proof && next === generation) proof = mountAudioProof(host, options);
  }).catch(error => { host.textContent = `Audio cleanup failed: ${String(error)}`; });
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', start);
if (import.meta.hot) import.meta.hot.dispose(() => {
  window.removeEventListener('pagehide', stop);
  window.removeEventListener('pageshow', start);
  stop();
});
