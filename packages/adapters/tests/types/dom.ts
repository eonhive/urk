/**
 * Company: EonHive Inc.
 * Title: DOM Adapter Public Type Checks
 * Purpose: Check independent adapter contracts without monorepo aliases or Three.js.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-12
 * Notes: Vibe coded with Codex.
 */

import { AdapterRegistry, ResourceScope, type AdapterRegistration } from '@urk/core';
import { MotionCapability, createMotionAdapter, createMotionController, type MotionAdapterApi, type MotionPlayback, type MotionHandle, type TimelineHandle, type ValueTweenOptions } from '@urk/adapters/motion';
import { VideoCapability, createVideoAdapter, type VideoAdapterApi, type VideoSnapshot, type VideoHandle } from '@urk/adapters/video';
import { AudioCapability, createAudioAdapter, type AudioAdapterApi } from '@urk/adapters/audio';
import { InputCapability, createInputAdapter, type InputAdapterApi } from '@urk/adapters/input';
import { LoadingCapability, createLoadingAdapter, type LoadingAdapterApi } from '@urk/adapters/loading';
import { PointerCapability, createPointerAdapter, type PointerAdapterApi } from '@urk/adapters/pointer';
import { StorageCapability, createStorageAdapter, type StorageAdapterApi } from '@urk/adapters/storage';
import { UiWidgetsCapability, createUiWidgetsAdapter, type UiWidgetsAdapterApi } from '@urk/adapters/ui-widgets';
import { UiOverlayCapability, createUiOverlayAdapter, type UiOverlayAdapterApi, type UiOverlayCallout } from '@urk/adapters/ui-overlay';
import { LoadingCapability as DomLoadingCapability } from '@urk/adapters/dom';

declare const registry: AdapterRegistry;
const motion: MotionAdapterApi = registry.require(MotionCapability);
const motionRegistration: AdapterRegistration<MotionAdapterApi> = createMotionAdapter();
const scopedMotion = motion.scoped(new ResourceScope());
const playback: MotionPlayback = scopedMotion.animate(document.body, [{ opacity: 0 }, { opacity: 1 }], { durationMs: 200 });
playback.finished.then(result => {
  if (result.status === 'failed') console.error(result.error);
});
// @ts-expect-error The initial DOM motion surface does not support layout animation.
scopedMotion.animate(document.body, [{ width: '10px' }, { width: '20px' }], { durationMs: 200 });
// @ts-expect-error Duration uses explicit milliseconds.
scopedMotion.animate(document.body, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
void motionRegistration;
const audio: AudioAdapterApi = registry.require(AudioCapability);
const input: InputAdapterApi = registry.require(InputCapability);
const loading: LoadingAdapterApi = registry.require(LoadingCapability);
const pointer: PointerAdapterApi = registry.require(PointerCapability);
const storage: StorageAdapterApi = registry.require(StorageCapability);
const widgets: UiWidgetsAdapterApi = registry.require(UiWidgetsCapability);
const overlay: UiOverlayAdapterApi = registry.require(UiOverlayCapability);
const legacyOverlay: UiWidgetsAdapterApi = overlay;
const overlayRegistration: AdapterRegistration<UiWidgetsAdapterApi> = createUiOverlayAdapter();
const callout: UiOverlayCallout = { title: 'Ready', body: 'Overlay alias', tone: 'active' };
overlay.showCallout(callout);
const managedCallout = overlay.open({ id: 'details', kind: 'callout', title: 'Selection', body: 'Ready' });
managedCallout.update({ body: 'Updated', placement: 'bottom-end' });
const managedStatus = overlay.open({ id: 'load', kind: 'status', message: 'Loading', progress: 0.5 });
managedStatus.update({ progress: null });
const managedPanel = overlay.open({ id: 'panel', kind: 'panel', title: 'Settings', mount(container) {
  container.textContent = 'Application content';
  return () => container.replaceChildren();
} });
managedPanel.update({ title: 'Updated settings' });
// @ts-expect-error Panel content is mounted once per owned instance.
managedPanel.update({ mount: () => {} });
// @ts-expect-error Callout updates cannot change a status message.
managedCallout.update({ message: 'Wrong kind' });
// @ts-expect-error Observation does not expose mutable collections.
overlay.getSnapshot().overlays.push({});
void [managedCallout, managedStatus, managedPanel];
void [legacyOverlay, overlayRegistration];
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

const video: VideoAdapterApi = registry.require(VideoCapability);
const videoRegistration: AdapterRegistration<VideoAdapterApi> = createVideoAdapter();
const player: VideoHandle = video.register({
  id: 'preview', element: document.createElement('video'), src: '/film.mp4',
  visibility: { target: document.body, loadWhenVisible: true, pauseWhenHidden: true, pauseWhenOffscreen: true },
});
const snapshot: VideoSnapshot = player.getSnapshot();
void [videoRegistration, snapshot];

import { createAudioMixerAdapter, AudioMixerCapability, type AudioMixerApi } from '@urk/adapters/audio/mixer';
const mixer: AudioMixerApi = registry.require(AudioMixerCapability);
const mixerRegistration: AdapterRegistration<AudioMixerApi> = createAudioMixerAdapter({ channels: [{ id: 'music', group: 'music' }] });
void [mixer, mixerRegistration];

const point = { x: 0, label: 'point' };
scopedMotion.tween(point, { x: 1 }, { durationMs: 200, onUpdate() {} });
// @ts-expect-error Only numeric properties can be tweened.
scopedMotion.tween(point, { label: 1 }, { durationMs: 200 });
const numericOptions: ValueTweenOptions = { from: 0, to: 100, durationMs: 300, easing: p => p * p, onUpdate(value, progress) { void [value, progress]; } };
const valueHandle: MotionHandle = motion.tween(numericOptions);
const timelineHandle: TimelineHandle = scopedMotion.timeline({ tweens: [{ ...numericOptions, atMs: 200 }] });
timelineHandle.seek(timelineHandle.durationMs / 2);
const playhead: number = timelineHandle.currentTimeMs;
void playhead;
// @ts-expect-error Timeline positions use numeric milliseconds.
timelineHandle.seek('50%');
// @ts-expect-error Standalone value tweens retain their existing handle surface.
valueHandle.seek(100);
void [valueHandle.status, valueHandle.progress, timelineHandle.finished, createMotionController()];
// @ts-expect-error Numeric callbacks receive numbers.
motion.tween({ ...numericOptions, onUpdate(value: string) { void value; } });
audio.analysis.configure({ fftSize: 2048, smoothing: 0.8, bands: { bass: [20, 250] } });
const waveform: Float32Array = audio.analysis.read().waveform;
const spectrum: Uint8Array = audio.analysis.read().spectrum;
void [waveform, spectrum];
