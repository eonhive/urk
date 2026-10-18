/**
 * Company: EonHive Inc. | Title: Video Adapter
 * Purpose: Register independent native video capabilities within URK ownership and cancellation.
 * Author: Stan Nesi | Created: 2026-10-12 | Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { CleanupError, token, type AdapterRegistration } from '@urk/core';
import { createVideoPlayer } from './player.js';
import type { VideoAdapterApi, VideoRegistration } from './types.js';

export * from './types.js';
export const VideoCapability = token<VideoAdapterApi>('video');

// A native element has one transport. Track only active ownership, weakly, so an
// old kernel's pending play cannot pause an element handed to a fresh kernel.
const elementOwners = new WeakMap<HTMLVideoElement, object>();

export function createVideoAdapter(id = 'video-adapter'): AdapterRegistration<VideoAdapterApi> {
  return {
    id,
    capability: 'video',
    token: VideoCapability,
    isSupported: () => typeof document !== 'undefined' && typeof HTMLVideoElement !== 'undefined',
    setup(ctx) {
      const players = new Map<string, ReturnType<typeof createVideoPlayer>>();
      const cancellationErrors: unknown[] = [];
      const cancel = () => {
        for (const player of players.values()) {
          try {
            player.cancel();
          } catch (error) {
            cancellationErrors.push(error);
          }
        }
      };
      ctx.signal.addEventListener('abort', cancel, { once: true });
      ctx.scope.defer(() => {
        ctx.signal.removeEventListener('abort', cancel);
        const errors = cancellationErrors.splice(0);
        for (const id of [...players.keys()].reverse()) {
          try {
            unregister(id);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length) throw new CleanupError(errors, 'Video cleanup failed.');
      });

      function unregister(id: string): void {
        const player = players.get(id);
        if (!player) return;
        players.delete(id);
        try {
          player.dispose();
        } finally {
          elementOwners.delete(player.handle.element);
        }
      }

      return {
        register(options: VideoRegistration) {
          options = { ...options };
          if (ctx.signal.aborted) throw new DOMException('Video adapter is disposed.', 'AbortError');
          if (!options.id.trim()) throw new TypeError('Video id must not be empty.');
          if (players.has(options.id)) throw new Error(`Video already registered: ${options.id}`);
          if (!options.element && options.ownership === 'borrowed')
            throw new Error('Borrowed video requires an element.');
          const element = options.element ?? document.createElement('video');
          if (elementOwners.has(element)) throw new Error('Video element is already registered.');
          const owner = {};
          let published = false;
          elementOwners.set(element, owner);
          try {
            const player = createVideoPlayer(
              { ...options, ownership: options.ownership ?? (options.element ? 'borrowed' : 'owned') },
              element,
              ctx.signal,
              (snapshot, event) => {
                // Registration must be complete before runtime observers can reenter it.
                if (!published) return;
                try {
                  ctx.events.emit({
                    type: `video:${event}`,
                    source: id,
                    timestamp: Date.now(),
                    payload: snapshot,
                  });
                } catch {
                  /* A diagnostics subscriber must not interrupt media transport. */
                }
              },
              () => !elementOwners.has(element) || elementOwners.get(element) === owner,
            );
            if (ctx.signal.aborted) {
              player.dispose();
              throw new DOMException('Video registration cancelled.', 'AbortError');
            }
            players.set(options.id, player);
            published = true;
            return player.handle;
          } catch (cause) {
            elementOwners.delete(element);
            throw cause;
          }
        },
        unregister,
        get: (id) => players.get(id)?.handle,
        getSnapshots: () => Object.freeze([...players.values()].map((player) => player.handle.getSnapshot())),
      };
    },
  };
}
