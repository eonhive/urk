/**
 * Company: EonHive Inc.
 * Title: Composite Adapter Public Type Checks
 * Purpose: Preserve root and DOM contracts alongside the independent Three adapter entrypoint.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-07
 * Notes: Vibe coded with Codex.
 */

import { AdapterRegistry, type AdapterRegistration } from '@urk/core';
import {
  AudioCapability, InputCapability, LoadingCapability, PointerCapability, StorageCapability,
  ThreeCapability, UiWidgetsCapability, createThreeAdapter, type AudioAdapterApi,
  type InputAdapterApi, type LoadingAdapterApi, type PointerAdapterApi, type StorageAdapterApi,
  type ThreeAdapterApi, type ThreeContextEventPayload, type UiWidgetsAdapterApi,
} from '@urk/adapters';
import { ThreeCapability as LeafThreeCapability, type ThreeContextEventPayload as LeafContextEventPayload } from '@urk/adapters/three';
import { PointerCapability as DomPointerCapability } from '@urk/adapters/dom';
import type { Scene, WebGLRenderer } from 'three';

declare const registry: AdapterRegistry;
const audio: AudioAdapterApi = registry.require(AudioCapability);
const input: InputAdapterApi = registry.require(InputCapability);
const loading: LoadingAdapterApi = registry.require(LoadingCapability);
const pointer: PointerAdapterApi = registry.require(PointerCapability);
const storage: StorageAdapterApi = registry.require(StorageCapability);
const three: ThreeAdapterApi = registry.require(ThreeCapability);
const widgets: UiWidgetsAdapterApi = registry.require(UiWidgetsCapability);
const scene: Scene = registry.require(LeafThreeCapability).getScene();
const renderer: WebGLRenderer = three.getRenderer();
const domPointer: PointerAdapterApi = registry.require(DomPointerCapability);
const registration: AdapterRegistration<ThreeAdapterApi> = createThreeAdapter('scene-custom');
const contextEvent: ThreeContextEventPayload = { host: three.getHost(), canvas: three.getCanvas() };
const leafContextEvent: LeafContextEventPayload = contextEvent;

// @ts-expect-error The DOM composite keeps its existing surface without Three exports.
import { createThreeAdapter as domThree } from '@urk/adapters/dom';
// @ts-expect-error Audio remains available through its root or independent entrypoint.
import { createAudioAdapter as domAudio } from '@urk/adapters/dom';

void [audio, input, loading, pointer, storage, widgets, scene, renderer, domPointer, registration, domThree, domAudio, leafContextEvent];
