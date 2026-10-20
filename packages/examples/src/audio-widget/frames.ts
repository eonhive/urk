/**
 * Company: EonHive Inc. | Title: Scoped Audio Analysis Frames
 * Purpose: Share demand-based analysis reads between Audio Lab and borrowed-runtime widgets.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { AudioCapability, type AudioAnalysisSnapshot } from '@urk/adapters/audio';

/** Call refresh after analysis settings change; transport/lifecycle changes are observed. */
export function observeAudioFrames(
  ctx: RuntimeContext,
  render: (snapshot: AudioAnalysisSnapshot) => void,
): () => void {
  const audio = ctx.require(AudioCapability);
  let releaseFrame: (() => void) | undefined;
  let closed = false;
  const stop = () => {
    releaseFrame?.();
    releaseFrame = undefined;
  };
  const close = () => { closed = true; stop(); };
  const refresh = () => {
    if (closed || ctx.signal.aborted) return;
    const transport = audio.getSnapshot();
    const running = ctx.getLifecycleSnapshot().state === 'running';
    if (running && transport.status === 'playing' && audio.analysis.enabled &&
        !transport.muted && transport.volume > 0) {
      releaseFrame ??= ctx.registerFrameWork(() => render(audio.analysis.read()));
    } else stop();
    render(audio.analysis.read());
  };
  ctx.scope.defer(close);
  ctx.scope.defer(audio.subscribe(refresh));
  ctx.scope.defer(ctx.subscribeLifecycle(refresh));
  ctx.signal.addEventListener('abort', close, { once: true });
  ctx.scope.defer(() => ctx.signal.removeEventListener('abort', close));
  refresh();
  return refresh;
}
