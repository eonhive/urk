/**
 * Company: EonHive Inc. | Title: Video Texture Public Types
 * Purpose: Check the optional binding accepts a controller owner and returns a native texture.
 * Author: Stan Nesi | Created: 2026-10-13 | Updated: 2026-10-13
 * Notes: Vibe coded with Codex.
 */
import type { RuntimeContext } from '@urk/core';
import type { VideoHandle } from '@urk/adapters/video';
import { createVideoTexture, type VideoTextureBinding } from '@urk/adapters/three/video';
import type { VideoTexture } from 'three';
declare const ctx: RuntimeContext;
declare const player: VideoHandle;
const binding: VideoTextureBinding = createVideoTexture(player, ctx);
const texture: VideoTexture = binding.texture;
binding.dispose();
// @ts-expect-error Texture ownership requires a cancellation signal and resource scope.
createVideoTexture(player, {});
void texture;
