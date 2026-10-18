/**
 * Company: EonHive Inc. | Title: Optional Gallery Ownership
 * Purpose: Load the shared 3D scene lazily and retain ownership through cancelled setup.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import { ResourceScope, type RuntimeContext } from '@urk/core';
import type { VideoHandle } from '@urk/adapters/video';
import type { Branch } from './bookmarks.js';
import type { createMediaView } from './view.js';
import type { mountGalleryScene } from './gallery.js';

export function createGallery(
  ctx: RuntimeContext,
  view: ReturnType<typeof createMediaView>,
  player: VideoHandle,
  choose: (branch: Branch) => void,
) {
  type Scene = Awaited<ReturnType<typeof mountGalleryScene>>;
  type Session = { abort: AbortController; scope: ResourceScope; ready: Promise<boolean>; scene?: Scene };
  let session: Session | undefined;
  let suspended = false;
  let branch: Branch = null;
  let time = 0;
  let cleanup = Promise.resolve();
  ctx.services.register('three:host', view.gallerySurface);

  function close() {
    const current = session;
    session = undefined;
    if (!current) return cleanup;
    current.abort.abort();
    // Imports cannot be cancelled. Wait for their continuation before releasing ownership.
    cleanup = Promise.all([cleanup, current.ready]).then(async () => { await current.scope.dispose(); });
    return cleanup;
  }
  const abort = () => { void close().catch(() => {}); };
  ctx.signal.addEventListener('abort', abort, { once: true });
  ctx.scope.defer(async () => {
    ctx.signal.removeEventListener('abort', abort);
    await close();
  });
  return {
    active: () => session !== undefined,
    open(): Promise<boolean> {
      if (session) return session.ready;
      if (ctx.signal.aborted) return Promise.resolve(false);
      const current: Session = { abort: new AbortController(), scope: new ResourceScope(), ready: Promise.resolve(false) };
      session = current;
      view.galleryStatus.textContent = 'Loading the gallery…';
      const previousCleanup = cleanup;
      current.ready = Promise.resolve().then(async () => {
        try {
          await previousCleanup;
          const module = await import('./gallery.js');
          if (current.abort.signal.aborted) return false;
          current.scene = await module.mountGalleryScene({ ...ctx, scope: current.scope, signal: current.abort.signal }, view, player, choose);
          if (current.abort.signal.aborted) return false;
          current.scene.suspend(suspended);
          current.scene.sync(branch, time);
          view.galleryStatus.textContent = 'Select an object, or use the buttons. 1 Explore · 2 Create';
          return true;
        } catch (error) {
          await current.scope.dispose();
          if (current.abort.signal.aborted) return false;
          if (session === current) session = undefined;
          view.galleryStatus.textContent = '3D is unavailable. Return to the film or try again.';
          return false;
        }
      });
      return current.ready;
    },
    close,
    sync(nextBranch: Branch, nextTime: number) {
      branch = nextBranch;
      time = nextTime;
      session?.scene?.sync(branch, time);
    },
    suspend(value: boolean) { suspended = value; session?.scene?.suspend(value); },
    resize() { session?.scene?.resize(); },
  };
}
