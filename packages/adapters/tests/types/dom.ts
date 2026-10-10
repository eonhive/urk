/**
 * Company: EonHive Inc.
 * Title: DOM Adapter Public Type Checks
 * Purpose: Check independent adapter contracts without monorepo aliases or Three.js.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import { AdapterRegistry, type AdapterRegistration } from '@urk/core';
import { AudioCapability, createAudioAdapter, type AudioAdapterApi } from '@urk/adapters/audio';
import { InputCapability, createInputAdapter, type InputAdapterApi } from '@urk/adapters/input';
import { LoadingCapability, createLoadingAdapter, type LoadingAdapterApi } from '@urk/adapters/loading';
import { PointerCapability, createPointerAdapter, type PointerAdapterApi } from '@urk/adapters/pointer';
import { StorageCapability, createStorageAdapter, type StorageAdapterApi } from '@urk/adapters/storage';
import { UiWidgetsCapability, createUiWidgetsAdapter, type UiWidgetsAdapterApi } from '@urk/adapters/ui-widgets';
import { LoadingCapability as DomLoadingCapability } from '@urk/adapters/dom';

declare const registry: AdapterRegistry;
const audio: AudioAdapterApi = registry.require(AudioCapability);
const input: InputAdapterApi = registry.require(InputCapability);
const loading: LoadingAdapterApi = registry.require(LoadingCapability);
const pointer: PointerAdapterApi = registry.require(PointerCapability);
const storage: StorageAdapterApi = registry.require(StorageCapability);
const widgets: UiWidgetsAdapterApi = registry.require(UiWidgetsCapability);
const domLoading: LoadingAdapterApi | undefined = registry.get(DomLoadingCapability);
const optionalAudio: AudioAdapterApi | undefined = registry.get(AudioCapability);
const stored: { volume: number } | null = storage.getItem<{ volume: number }>('settings');

const registration: AdapterRegistration<AudioAdapterApi> = createAudioAdapter('audio-custom');
const configured = [
  registration, createInputAdapter('input-custom'), createLoadingAdapter('loading-custom'),
  createPointerAdapter('pointer-custom'), createStorageAdapter({ id: 'storage-custom', namespace: 'test' }),
  createUiWidgetsAdapter('ui-custom'),
];

// @ts-expect-error A loading token cannot satisfy the audio contract.
const wrong: AudioAdapterApi = registry.require(LoadingCapability);
// @ts-expect-error The input API has no Three renderer.
registry.require(InputCapability).getRenderer();
// @ts-expect-error Optional lookup must be narrowed before using its API.
registry.get(AudioCapability).pause();

void [audio, input, loading, pointer, widgets, domLoading, optionalAudio, stored, configured, wrong];
