/**
 * Company: EonHive Inc. | Title: Scoped Video Texture
 * Purpose: Connect a borrowed video handle to an owned Three.js texture.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import { SRGBColorSpace, VideoTexture } from 'three';
import type { VideoHandle } from '../video/types.js';

export interface VideoTextureBinding {
  readonly texture: VideoTexture;
  dispose(): void;
}

/** Recreate the binding after replacing the source or changing its dimensions. */
export function createVideoTexture(
  player: VideoHandle,
  owner: Pick<RuntimeContext, 'scope' | 'signal'>,
): VideoTextureBinding {
  if (owner.signal.aborted || player.getSnapshot().status === 'disposed') {
    throw new DOMException('Video texture owner is unavailable.', 'AbortError');
  }
  const texture = new VideoTexture(player.element);
  texture.colorSpace = SRGBColorSpace;
  let disposed = false;
  let unsubscribe = () => {};
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    owner.signal.removeEventListener('abort', dispose);
    unsubscribe();
    texture.dispose();
  };
  try {
    owner.scope.defer(dispose);
    unsubscribe = player.subscribe(snapshot => {
      if (snapshot.status === 'disposed') dispose();
    });
    owner.signal.addEventListener('abort', dispose, { once: true });
  } catch (error) {
    dispose();
    throw error;
  }
  return { texture, dispose };
}
