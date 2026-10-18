/**
 * Company: EonHive Inc. | Title: Film Reload
 * Purpose: Reload one film and restore its position without playing or retaining cancelled work.
 * Author: Stan Nesi | Created: 2026-10-14 | Updated: 2026-10-14
 * Notes: Vibe coded with Codex.
 */
import type { VideoHandle, VideoSnapshot } from '@urk/adapters/video';

export function reloadFilm(player: VideoHandle, src: string, position: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sought = false;
    let unsubscribe = () => {};
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      signal.removeEventListener('abort', cancel);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => finish(new DOMException('Film reload cancelled.', 'AbortError'));
    const observe = (snapshot: VideoSnapshot, event: string) => {
      if (settled) return;
      if (snapshot.status === 'disposed' || signal.aborted) { cancel(); return; }
      if (snapshot.error) { finish(new Error(snapshot.error.message)); return; }
      try {
        // Wait for this source's metadata, not the old source's synchronous pause event.
        if (!sought && event === 'loadedmetadata') {
          sought = true;
          const duration = snapshot.duration;
          const target = duration !== null && Number.isFinite(duration) ? Math.min(position, duration) : position;
          player.seek(target);
        }
        if (sought && player.element.readyState >= 2 && !player.element.seeking) finish();
      } catch (error) {
        finish(error);
      }
    };
    if (signal.aborted) { cancel(); return; }
    try {
      unsubscribe = player.subscribe(observe);
      signal.addEventListener('abort', cancel, { once: true });
      player.setSource(src);
    } catch (error) {
      finish(error);
    }
  });
}
