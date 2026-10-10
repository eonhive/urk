/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Shared Experience
 * Purpose: Share loading, interaction, ownership, and recovery across standalone and framework hosts.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-09
 * Notes: Vibe coded with Codex.
 */

import { createKernel, ResourceScope, token, type Kernel } from '@urk/core';
import { createAudioAdapter, AudioCapability } from '@urk/adapters/audio';
import { createInputAdapter, InputCapability } from '@urk/adapters/input';
import { createLoadingAdapter, LoadingCapability } from '@urk/adapters/loading';
import { createPointerAdapter, PointerCapability, type PointerTargetEventPayload, type PointerSurfaceEventPayload } from '@urk/adapters/pointer';
import { createStorageAdapter, StorageCapability } from '@urk/adapters/storage';
import { createThreeAdapter } from '@urk/adapters/three';
import { createUiWidgetsAdapter, UiWidgetsCapability } from '@urk/adapters/ui-widgets';
import { choices, createPlaygroundScene, isChoice, type Choice } from './scene.js';
import { styles } from './styles.js';

export interface DemoPreferences { selected: string | null; volume?: number }
export const DemoPreferencesCapability = token<DemoPreferences>('demo:preferences');
const DemoViewCapability = token<{
  root: HTMLElement;
  viewport: HTMLElement;
  cards: HTMLButtonElement[];
  sound: HTMLButtonElement;
  volume: HTMLInputElement;
  soundStatus: HTMLElement;
}>('demo:view');

// Borrowed storage survives a fresh kernel; the adapter never owns its contents.
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => values.clear(),
  };
}
const sessionPreferences = memoryStorage();

function browserStorage(area: 'localStorage' | 'sessionStorage', fallback: Storage): Storage {
  try {
    const storage = window[area];
    const probe = 'urk:v02:availability';
    const previous = storage.getItem(probe);
    storage.setItem(probe, '1');
    if (previous === null) storage.removeItem(probe);
    else storage.setItem(probe, previous);
    return storage;
  } catch {
    return fallback;
  }
}

function isVolume(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Construct an inert kernel; the host and browser resources are read only in hooks. */
export function createV02Experience(
  getHost: () => HTMLElement | null,
  options: { failSetup?: boolean; preferences?: DemoPreferences } = {},
): Kernel {
  const preferences = options.preferences ?? { selected: null };
  const widgets = createUiWidgetsAdapter();
  const three = createThreeAdapter();
  const input = createInputAdapter();
  const storage = createStorageAdapter({ namespace: 'urk:v02' });
  for (const adapter of [widgets, three, input, storage]) adapter.dependsOn = [DemoViewCapability];
  let updatePaused = (_paused: boolean): void => {};

  return createKernel({
    frameMode: 'auto',
    adapterStartup: 'parallel',
    serviceBindings: [{ token: DemoPreferencesCapability, value: preferences }],
    adapters: [
      widgets, three, input, storage, createAudioAdapter(), createLoadingAdapter(), createPointerAdapter(),
      {
        id: 'demo-view', capability: 'demo:view', token: DemoViewCapability,
        setup(ctx) {
          const host = getHost();
          if (!host) throw new Error('Mount the experience before starting it.');
          const root = document.createElement('div');
          ctx.scope.defer(() => root.remove());
          root.dataset.urkOwned = 'v02';
          root.className = 'surface';
          root.innerHTML = `<div class="scene-shell">
            <div class="viewport" tabindex="0" role="group" aria-label="Interactive objects" aria-describedby="${ctx.id}-help"></div>
            <div class="scene-overlay" data-overlay></div></div>
          <div class="scene-caption" id="${ctx.id}-help"><span>Pick an object. Find your next move.</span>
            <span><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> select · arrow keys rotate</span></div>
          <div class="cards">
            <button data-card="Explore" aria-pressed="false"><strong>Explore</strong><small>Choose a direction.</small></button>
            <button data-card="Create" aria-pressed="false"><strong>Create</strong><small>Make the next move.</small></button>
            <button data-card="Connect" aria-pressed="false"><strong>Connect</strong><small>Bring it together.</small></button>
          </div><div class="interaction-bar">
            <button data-sound aria-pressed="false">Enable sound</button>
            <label class="volume">Volume <input type="range" min="0" max="1" step="0.05" aria-label="Volume"></label>
            <span class="storage-label" data-storage></span>
            <output class="local-status" data-sound-status aria-live="polite">Sound is off. Enable it to hear selections.</output>
          </div>`;
          host.append(root);
          if (options.failSetup) throw new Error('Deliberate setup failure. The acquired surface was cleaned up.');
          const viewport = root.querySelector<HTMLElement>('.viewport')!;
          const local = browserStorage('localStorage', sessionPreferences);
          root.querySelector('[data-storage]')!.textContent = local === sessionPreferences ? 'Session only' : 'Preferences saved';
          ctx.services.register('storage:local', local);
          ctx.services.register('storage:session', browserStorage('sessionStorage', sessionPreferences));
          ctx.services.register('three:host', viewport);
          ctx.services.register('input:target', root);
          ctx.services.register('ui:host', root.querySelector<HTMLElement>('[data-overlay]')!);
          return {
            root, viewport, cards: [...root.querySelectorAll<HTMLButtonElement>('[data-card]')],
            sound: root.querySelector<HTMLButtonElement>('[data-sound]')!,
            volume: root.querySelector<HTMLInputElement>('input')!,
            soundStatus: root.querySelector<HTMLElement>('[data-sound-status]')!,
          };
        },
      },
    ],
    controllers: [{
      id: 'demo-experience',
      onStateChange(next) { updatePaused(next.phase === 'paused'); },
      async start(ctx) {
        const view = ctx.require(DemoViewCapability);
        const loading = ctx.require(LoadingCapability);
        const pointer = ctx.require(PointerCapability);
        const input = ctx.require(InputCapability);
        const storage = ctx.require(StorageCapability);
        const audio = ctx.require(AudioCapability);
        const overlay = ctx.require(UiWidgetsCapability);
        const saved = ctx.require(DemoPreferencesCapability);
        loading.begin([{ id: 'preferences', label: 'Restore preferences' }, { id: 'scene', label: 'Build scene' }, { id: 'interaction', label: 'Connect controls' }]);
        ctx.scope.defer(loading.subscribe(snapshot => overlay.setStatus(`${snapshot.message ?? 'Preparing experience'} · ${Math.round(snapshot.progress * 100)}%`)));
        let stored: Partial<DemoPreferences> = {};
        try {
          const value = storage.getItem<unknown>('preferences');
          if (value && typeof value === 'object') stored = value;
        } catch { /* Invalid or unavailable saved data must not prevent startup. */ }
        saved.selected = isChoice(saved.selected) ? saved.selected : isChoice(stored.selected) ? stored.selected : 'Explore';
        saved.volume = isVolume(saved.volume) ? saved.volume : isVolume(stored.volume) ? stored.volume : 0.35;
        view.volume.value = String(saved.volume);
        const persist = (): void => {
          try { storage.setItem('preferences', { selected: saved.selected, volume: saved.volume }); }
          catch {
            sessionPreferences.setItem('urk:v02:preferences', JSON.stringify(saved));
            view.root.querySelector('[data-storage]')!.textContent = 'Session only';
          }
        };
        loading.setStage('preferences', 1);
        const scene = createPlaygroundScene(ctx);
        loading.setStage('scene', 1);
        let paused = false;
        let soundEnabled = false;
        let soundGeneration = 0;
        let pendingSound: Promise<void> | undefined;
        audio.registerTrack({ id: 'confirm', label: 'Selection', src: '/audio/confirm.wav' });
        audio.setVolume(saved.volume);
        audio.setMuted(true);
        const stopSound = (): void => {
          soundGeneration++;
          // A browser play promise can settle late; muting also silences that interval.
          audio.setMuted(true);
          audio.stop();
        };
        const playSound = (): void => {
          if (!soundEnabled || paused || ctx.signal.aborted || pendingSound) return;
          const generation = soundGeneration;
          const current = (): boolean => generation === soundGeneration && soundEnabled && !paused && !ctx.signal.aborted;
          pendingSound = (async () => {
            try {
              await audio.preload('confirm');
              if (!current()) return;
              audio.setMuted(false);
              await audio.play('confirm');
              if (!current()) audio.stop();
            } catch {
              audio.stop();
              if (current()) view.soundStatus.textContent = 'Sound unavailable. You can still explore, or disable and retry.';
            }
          })().finally(() => { pendingSound = undefined; });
        };
        ctx.scope.defer(audio.subscribe(snapshot => {
          view.root.dataset.audioState = snapshot.status;
          if (!soundEnabled || paused || ctx.signal.aborted) return;
          view.soundStatus.textContent = snapshot.status === 'error' ? 'Sound unavailable. You can still explore, or disable and retry.'
            : snapshot.status === 'loading' ? 'Loading sound…' : 'Sound enabled. Select an object to hear it.';
        }));
        ctx.signal.addEventListener('abort', stopSound, { once: true });
        ctx.scope.defer(async () => {
          stopSound();
          ctx.signal.removeEventListener('abort', stopSound);
          // Keep the adapter alive until a delayed browser play request has settled.
          await pendingSound;
          stopSound();
        });
        updatePaused = value => {
          paused = value;
          scene.setPaused(value);
          view.root.dataset.paused = String(value);
          for (const control of [...view.cards, view.sound, view.volume]) control.disabled = value;
          view.viewport.setAttribute('aria-disabled', String(value));
          if (value) stopSound();
          view.soundStatus.textContent = value ? 'Paused. Interaction and sound are resting.'
            : soundEnabled ? 'Sound enabled. Select an object to hear it.' : 'Sound is off. Enable it to hear selections.';
        };
        ctx.scope.defer(() => { updatePaused = () => {}; });
        const select = (choice: Choice, fromInteraction = false): void => {
          if (paused || ctx.signal.aborted) return;
          saved.selected = choice;
          for (const card of view.cards) card.setAttribute('aria-pressed', String(card.dataset.card === choice));
          scene.select(choice);
          overlay.setStatus(`Selected: ${choice}`);
          persist();
          if (fromInteraction) playSound();
          ctx.events.emit({ type: 'demo:selected', source: 'demo-experience', timestamp: Date.now(), payload: { label: choice } });
        };
        ctx.scope.defer(ctx.events.on('pointer:select', event => {
          const payload = event.payload as PointerTargetEventPayload;
          if (view.cards.includes(payload.element as HTMLButtonElement) && isChoice(payload.meta?.label)) select(payload.meta.label, true);
        }));
        for (const card of view.cards) ctx.scope.defer(pointer.bindTarget({ id: card.dataset.card!, element: card, meta: { label: card.dataset.card } }));
        ctx.scope.defer(pointer.bindSurface({ id: 'playground', element: view.viewport }));
        ctx.scope.defer(ctx.events.on('pointer:surface-select', event => {
          const payload = event.payload as PointerSurfaceEventPayload;
          if (payload.element !== view.viewport || paused || ctx.signal.aborted) return;
          view.viewport.focus({ preventScroll: true });
          const choice = scene.pick(payload.clientX, payload.clientY);
          if (choice) select(choice, true);
        }));
        for (const code of ['Digit1', 'Digit2', 'Digit3', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
          ctx.scope.defer(input.bindKey({ code, allowRepeat: code.startsWith('Arrow'), handler(event) {
            const target = event.nativeEvent.target;
            if (paused || ctx.signal.aborted || event.altKey || event.ctrlKey || event.metaKey) return;
            if (target instanceof HTMLElement && target.closest('input,textarea,select,[contenteditable]')) return;
            event.nativeEvent.preventDefault();
            if (code.startsWith('Digit')) select(choices[Number(code.slice(-1)) - 1], true);
            else scene.rotate(code === 'ArrowUp' ? -0.15 : code === 'ArrowDown' ? 0.15 : 0, code === 'ArrowLeft' ? -0.15 : code === 'ArrowRight' ? 0.15 : 0);
          } }));
        }
        const toggleSound = (): void => {
          if (paused || ctx.signal.aborted) return;
          soundEnabled = !soundEnabled;
          view.sound.textContent = soundEnabled ? 'Disable sound' : 'Enable sound';
          view.sound.setAttribute('aria-pressed', String(soundEnabled));
          if (soundEnabled) playSound();
          else { stopSound(); view.soundStatus.textContent = 'Sound is off. Enable it to hear selections.'; }
        };
        const changeVolume = (): void => {
          if (paused || ctx.signal.aborted) return;
          saved.volume = Number(view.volume.value);
          audio.setVolume(saved.volume);
          persist();
        };
        view.sound.addEventListener('click', toggleSound);
        ctx.scope.defer(() => view.sound.removeEventListener('click', toggleSound));
        view.volume.addEventListener('input', changeVolume);
        ctx.scope.defer(() => view.volume.removeEventListener('input', changeVolume));
        loading.setStage('interaction', 1);
        loading.complete('Ready');
        select(saved.selected as Choice);
        await ctx.state.transition('ready', 'demo:loaded');
      },
    }],
  });
}

/** Host-owned controls survive disposal so recovery creates a fresh kernel. */
export function attachV02Controls(
  host: HTMLElement,
  kernel: Kernel,
  actions: { restart(failSetup: boolean): void; unmount(): void },
): () => Promise<void> {
  const scope = new ResourceScope();
  const root = document.createElement('div');
  root.innerHTML = `<style>${styles}</style><div class="eyebrow">UNIVERSAL RUNTIME KERNEL · V0.2</div>
    <h1>One experience. Any host.</h1><p>Pick a shape, turn it with your arrow keys, and add a little sound. Your preferences stay with you; the scene rests between interactions.</p>
    <div class="metrics"><div><span>Runtime</span><output data-testid="v02-lifecycle"></output></div>
      <div><span>Experience</span><output data-testid="v02-phase"></output></div>
      <div><span>Frame loop</span><output data-testid="v02-frames"></output></div>
      <div><span>Owned surfaces</span><output data-testid="v02-owned"></output></div></div>
    <div class="toolbar"><button data-action="pause">Pause</button><button data-action="resume">Resume</button>
      <button data-action="restart">Start fresh</button><button data-action="failure">Try setup failure</button>
      <button data-action="unmount">Unmount</button><button data-action="diagnostics">Show diagnostics</button></div>
    <output data-testid="v02-message"></output><pre data-testid="v02-diagnostics">Diagnostics off</pre>`;
  host.append(root);
  scope.defer(() => root.remove());
  const output = (name: string): HTMLElement => root.querySelector(`[data-testid="v02-${name}"]`)!;
  const refresh = (): void => {
    output('lifecycle').textContent = kernel.getLifecycleSnapshot().state;
    output('phase').textContent = kernel.getState().phase;
    output('frames').textContent = kernel.getContext().scheduler.isRunning() ? 'Running' : 'Idle';
    output('owned').textContent = String(host.parentElement?.querySelectorAll('[data-urk-owned="v02"]').length ?? 0);
    if (kernel.getState().phase === 'error') output('message').textContent = kernel.getState().reason ?? 'Setup failed';
  };
  scope.defer(kernel.subscribeLifecycle(refresh));
  scope.defer(kernel.getContext().state.subscribe(refresh));
  refresh();
  let detachDiagnostics: (() => void) | undefined;
  let restarting = false;
  scope.defer(() => detachDiagnostics?.());
  const onClick = (event: Event): void => {
    const action = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
    if (!action) return;
    const perform = async (): Promise<void> => {
      switch (action) {
        case 'pause': kernel.pause(); break;
        case 'resume': kernel.resume(); break;
        case 'restart':
        case 'failure':
          if (restarting) return;
          restarting = true;
          try {
            await kernel.shutdown();
            actions.restart(action === 'failure');
          } finally {
            restarting = false;
          }
          break;
        case 'unmount': actions.unmount(); break;
        case 'diagnostics': {
          if (detachDiagnostics) {
            detachDiagnostics(); detachDiagnostics = undefined;
            output('diagnostics').textContent = 'Diagnostics off';
          } else {
            const inspector = kernel.getInspector();
            const render = (): void => {
              const snapshot = inspector.getSnapshot();
              output('diagnostics').textContent = `Revision ${snapshot.revision} · ${snapshot.frameCount} frames · ${snapshot.totalEvents} observed events`;
            };
            detachDiagnostics = inspector.subscribe(render);
            render();
          }
          break;
        }
      }
      refresh();
    };
    void perform().catch(error => { output('message').textContent = error instanceof Error ? error.message : 'Runtime action failed'; });
  };
  root.addEventListener('click', onClick);
  scope.defer(() => root.removeEventListener('click', onClick));
  return () => scope.dispose();
}

export function mountV02Workbench(host: HTMLElement): { teardown(): Promise<void> } {
  const scope = new ResourceScope();
  host.classList.add('urk-v02');
  scope.defer(() => host.classList.remove('urk-v02'));
  const controls = document.createElement('div');
  const surface = document.createElement('div');
  scope.defer(() => { controls.remove(); surface.remove(); });
  host.append(controls, surface);
  const preferences: DemoPreferences = { selected: null };
  let kernel: Kernel;
  let detach: (() => Promise<void>) | undefined;
  let closed = false;
  let shutdown: Promise<void> | undefined;
  scope.defer(() => detach?.());
  scope.defer(() => shutdown);
  const start = (failSetup = false): void => {
    if (closed) return;
    void detach?.();
    kernel = createV02Experience(() => surface, { failSetup, preferences });
    detach = attachV02Controls(controls, kernel, {
      restart: start,
      unmount: () => { void kernel.shutdown(); },
    });
    void kernel.boot().catch(() => { /* The controls show the committed startup error. */ });
  };
  start();
  return {
    teardown() {
      closed = true;
      shutdown = kernel.shutdown();
      return scope.dispose();
    },
  };
}
