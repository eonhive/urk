/**
 * Company: EonHive Inc.
 * Title: Typed Capability Contract Tests
 * Purpose: Verify inferred token lookup and legacy compatibility through built public declarations.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import {
  AdapterRegistry,
  createKernel,
  ManualFrameScheduler,
  token,
  type AdapterRegistration,
  type CapabilityToken,
  type RuntimeContext,
} from '@urk/core';

interface AudioApi { play(): void }
interface PointerApi { x: number }

const Audio = token<AudioApi>('audio');
const Pointer = token<PointerApi>('pointer');
const api: AudioApi = { play() {} };
const audio: AdapterRegistration<AudioApi> = {
  id: 'audio-adapter', capability: 'audio', token: Audio, setup: () => api,
};
const dependent: AdapterRegistration<PointerApi> = {
  id: 'pointer-adapter', capability: 'pointer', token: Pointer,
  dependsOn: [Audio, 'audio-adapter'], setup: (ctx) => {
    ctx.adapters.require(Audio).play();
    return { x: 0 };
  },
};
const kernel = createKernel({ scheduler: new ManualFrameScheduler(), adapters: [audio, dependent] });
const registry = new AdapterRegistry();
declare const context: RuntimeContext;

const optional: AudioApi | undefined = registry.get(Audio);
const required: AudioApi = registry.require(Audio);
const legacy: AudioApi = registry.require<AudioApi>('audio');
const missing: unknown = registry.get('missing');
const erased: AdapterRegistration<unknown> = audio;
const setup: Promise<AudioApi> = kernel.registerAdapter(audio);
const mixed: string | CapabilityToken<AudioApi> = Audio;
const mixedValue: AudioApi | undefined = registry.get(mixed);
void [optional, required, legacy, missing, erased, setup, mixedValue];

// @ts-expect-error Optional lookup must be checked before reading its API.
registry.get(Audio).play();
// @ts-expect-error Token lookup infers the contract's API instead of any.
registry.require(Audio).x;
// @ts-expect-error An incompatible API cannot be requested through a typed token.
registry.require<PointerApi>(Audio);
// @ts-expect-error Adapter registration cannot replace the token API with an unrelated value.
registry.register({ id: 'bad', capability: 'bad', token: Audio, setup: () => ({ x: 0 }) }, context);
// @ts-expect-error Token metadata is readonly.
Audio.key = Symbol('replacement');
// @ts-expect-error Tokens must be constructed through the helper, not as untyped lookalikes.
const forged: CapabilityToken<AudioApi> = { key: Symbol('audio'), name: 'audio' };
void forged;

const invalid: AdapterRegistration<AudioApi> = {
  id: 'invalid', capability: 'invalid',
  // @ts-expect-error Registration's token must match its declared setup API.
  token: Pointer,
  setup: () => api,
};
void invalid;

const fromContext: AudioApi = context.require(Audio);
const serviceValue: AudioApi = context.services.require(Audio);
const typedService: AudioApi = kernel.registerService(Audio, api);
// @ts-expect-error Unified lookup retains token inference.
context.require(Audio).x;
void [fromContext, serviceValue, typedService];
