/**
 * Company: EonHive Inc.
 * Title: URK v0.2 Shared Experience
 * Purpose: Share loading, interaction, ownership, and recovery across standalone and framework hosts.
 * Author: Stan Nesi
 * Created: 2026-10-07
 * Updated: 2026-10-11
 * Notes: Vibe coded with Codex.
 */

import { createKernel, ResourceScope, token, type Kernel } from '@urk/core';
import { createAudioAdapter, AudioCapability } from '@urk/adapters/audio';
import { createInputAdapter, InputCapability } from '@urk/adapters/input';
import { createLoadingAdapter, LoadingCapability } from '@urk/adapters/loading';
import { createPointerAdapter, PointerCapability, type PointerTargetEventPayload, type PointerSurfaceEventPayload } from '@urk/adapters/pointer';
import { createStorageAdapter, StorageCapability } from '@urk/adapters/storage';
import { createThreeAdapter } from '@urk/adapters/three';
import { createUiOverlayAdapter, UiOverlayCapability } from '@urk/adapters/ui-overlay';
import { choices, createPlaygroundScene, isChoice, type Choice, type SceneLayout } from './scene.js';
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
  layout: HTMLSelectElement;
  rotation: HTMLInputElement;
  angle: HTMLOutputElement;
  selected: HTMLOutputElement;
  details: HTMLDetailsElement;
  detailsSummary: HTMLElement;
  detailsTitle: HTMLElement;
  detailsDescription: HTMLElement;
  wireframe: HTMLInputElement;
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
  const widgets = createUiOverlayAdapter();
  const three = createThreeAdapter();
  const input = createInputAdapter();
  const storage = createStorageAdapter({ namespace: 'urk:v02' });
  for (const adapter of [widgets, three, input, storage]) adapter.dependsOn = [DemoViewCapability];

  const kernel = createKernel({
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
          root.innerHTML = `<div class="scene-shell"><div class="scene-topline" aria-hidden="true"><span>SCENE / INTERACTIVE OBJECTS</span><span>3D</span></div>
            <div class="viewport" tabindex="0" role="group" aria-label="Interactive objects" aria-describedby="${ctx.id}-help"></div>
            <div class="scene-overlay" data-overlay></div></div>
          <div class="scene-caption" id="${ctx.id}-help"><span>Selected <output data-selected-name></output></span></div>
          <div class="cards">
            <button data-card="Explore" aria-pressed="false"><span class="choice-number" aria-hidden="true">01</span><strong>Explore</strong><small>Choose a direction.</small></button>
            <button data-card="Create" aria-pressed="false"><span class="choice-number" aria-hidden="true">02</span><strong>Create</strong><small>Make the next move.</small></button>
            <button data-card="Connect" aria-pressed="false"><span class="choice-number" aria-hidden="true">03</span><strong>Connect</strong><small>Bring it together.</small></button>
          </div><details class="selection-details">
            <summary>Selection details</summary>
            <section aria-labelledby="${ctx.id}-details-title">
              <div><h2 id="${ctx.id}-details-title" data-details-title></h2><p data-details-description></p></div>
              <label><input data-wireframe type="checkbox">Wireframe</label>
            </section>
          </details><div class="scene-controls" role="group" aria-label="Scene controls">
            <label>Layout <select aria-label="Scene layout"><option value="row">Row</option><option value="arc">Arc</option></select></label>
            <label class="rotation-control">Rotation <input data-rotation type="range" min="-180" max="180" step="1" aria-label="Selected object rotation"><output data-angle></output></label>
          </div><div class="interaction-bar">
            <button data-sound aria-pressed="false">Enable sound</button>
            <label class="volume">Volume <input data-volume type="range" min="0" max="1" step="0.05" aria-label="Volume"></label>
            <span class="storage-label" data-storage></span>
            <output class="local-status" data-sound-status aria-live="polite">Sound is off. Enable it to hear selections.</output>
          </div>`;
          host.classList.add('v02-surface-host');
          ctx.scope.defer(() => host.classList.remove('v02-surface-host'));
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
            volume: root.querySelector<HTMLInputElement>('[data-volume]')!,
            soundStatus: root.querySelector<HTMLElement>('[data-sound-status]')!,
            layout: root.querySelector<HTMLSelectElement>('select')!,
            rotation: root.querySelector<HTMLInputElement>('[data-rotation]')!,
            angle: root.querySelector<HTMLOutputElement>('[data-angle]')!,
            selected: root.querySelector<HTMLOutputElement>('[data-selected-name]')!,
            details: root.querySelector<HTMLDetailsElement>('.selection-details')!,
            detailsSummary: root.querySelector<HTMLElement>('.selection-details summary')!,
            detailsTitle: root.querySelector<HTMLElement>('[data-details-title]')!,
            detailsDescription: root.querySelector<HTMLElement>('[data-details-description]')!,
            wireframe: root.querySelector<HTMLInputElement>('[data-wireframe]')!,
          };
        },
      },
    ],
    controllers: [{
      id: 'demo-experience',
      async start(ctx) {
        const view = ctx.require(DemoViewCapability);
        const loading = ctx.require(LoadingCapability);
        const pointer = ctx.require(PointerCapability);
        const input = ctx.require(InputCapability);
        const storage = ctx.require(StorageCapability);
        const audio = ctx.require(AudioCapability);
        const overlay = ctx.require(UiOverlayCapability);
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
        let layoutPending = false;
        let layoutRevision = 0;
        const scene = createPlaygroundScene(ctx, () => {
          layoutPending = false;
          refreshOverlay();
          void ctx.state.transition('ready', 'demo:layout-settled').catch(() => {
            // Shutdown closes phase commands before owned scene work is released.
          });
        }, lost => {
          contextLost = lost;
          refreshSceneControls();
          resetPointerFeedback();
        });
        loading.setStage('scene', 1);
        let paused = false;
        let contextLost = scene.isContextLost();
        let soundEnabled = false;
        let soundGeneration = 0;
        let pendingSound: Promise<void> | undefined;
        const descriptions: Record<Choice, string> = {
          Explore: 'A faceted solid with triangular faces.',
          Create: 'A cube with six square faces.',
          Connect: 'A continuous knot with an open center.',
        };
        const refreshOverlay = (hovered?: Choice): void => {
          if (contextLost) {
            overlay.setStatus('Graphics unavailable. Waiting for recovery.');
            overlay.hideCallout();
            return;
          }
          overlay.setStatus(paused ? 'Paused' : layoutPending ? `Arranging: ${view.layout.selectedOptions[0].text}` : `Selected: ${saved.selected}`);
          if (paused) { overlay.hideCallout(); return; }
          const choice = hovered ?? saved.selected as Choice;
          overlay.showCallout({ title: choice, body: descriptions[choice], tone: hovered ? 'active' : 'selected' });
        };
        const resetPointerFeedback = (): void => {
          if (ctx.signal.aborted) return;
          view.viewport.style.cursor = 'default';
          refreshOverlay();
        };
        const syncRotation = (): void => {
          view.rotation.value = String(scene.getRotation());
          view.angle.value = `${view.rotation.value}°`;
          view.rotation.setAttribute('aria-valuetext', view.angle.value);
        };
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
        const refreshSceneControls = (): void => {
          const disabled = paused || contextLost;
          for (const control of [...view.cards, view.layout, view.rotation]) control.disabled = disabled;
          view.wireframe.disabled = disabled || ctx.signal.aborted;
          view.viewport.setAttribute('aria-disabled', String(disabled));
        };
        const updatePaused = (value: boolean): void => {
          paused = value;
          scene.setPaused(value);
          view.root.dataset.paused = String(value);
          view.sound.disabled = value;
          view.volume.disabled = value;
          refreshSceneControls();
          if (value) stopSound();
          view.soundStatus.textContent = value ? 'Paused. Interaction and sound are resting.'
            : soundEnabled ? 'Sound enabled. Select an object to hear it.' : 'Sound is off. Enable it to hear selections.';
          resetPointerFeedback();
        };
        ctx.scope.defer(kernel.subscribeLifecycle(() => updatePaused(kernel.getLifecycleSnapshot().state === 'paused')));
        const select = (choice: Choice, fromInteraction = false): void => {
          if (paused || ctx.signal.aborted || (contextLost && fromInteraction)) return;
          saved.selected = choice;
          for (const card of view.cards) card.setAttribute('aria-pressed', String(card.dataset.card === choice));
          scene.select(choice);
          view.selected.value = choice;
          view.detailsTitle.textContent = choice;
          view.detailsDescription.textContent = descriptions[choice];
          view.wireframe.checked = scene.getWireframe();
          if (fromInteraction) view.details.open = true;
          syncRotation();
          refreshOverlay();
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
        const onPointerDown = (event: PointerEvent): void => {
          if (event.pointerType === 'touch') resetPointerFeedback();
        };
        ctx.scope.defer(() => view.viewport.removeEventListener('pointerdown', onPointerDown));
        view.viewport.addEventListener('pointerdown', onPointerDown, { passive: true });
        ctx.scope.defer(ctx.events.on('pointer:surface-select', event => {
          const payload = event.payload as PointerSurfaceEventPayload;
          if (payload.element !== view.viewport || paused || contextLost || ctx.signal.aborted) return;
          view.viewport.focus({ preventScroll: true });
          const choice = scene.pick(payload.clientX, payload.clientY);
          if (choice) select(choice, true);
        }));
        ctx.scope.defer(ctx.events.on('pointer:surface-move', event => {
          const payload = event.payload as PointerSurfaceEventPayload;
          if (payload.element !== view.viewport || paused || contextLost || ctx.signal.aborted) return;
          if ('pointerType' in payload.nativeEvent && payload.nativeEvent.pointerType === 'touch') {
            resetPointerFeedback();
            return;
          }
          const hovered = scene.pick(payload.clientX, payload.clientY);
          view.viewport.style.cursor = hovered ? 'pointer' : 'default';
          refreshOverlay(hovered);
        }));
        ctx.scope.defer(ctx.events.on('pointer:surface-leave', event => {
          if ((event.payload as PointerSurfaceEventPayload).element === view.viewport) resetPointerFeedback();
        }));
        for (const code of ['Digit1', 'Digit2', 'Digit3', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']) {
          ctx.scope.defer(input.bindKey({ code, allowRepeat: code.startsWith('Arrow'), handler(event) {
            const target = event.nativeEvent.target;
            if (paused || contextLost || ctx.signal.aborted || event.altKey || event.ctrlKey || event.metaKey) return;
            if (target !== view.viewport) return;
            event.nativeEvent.preventDefault();
            if (code.startsWith('Digit')) select(choices[Number(code.slice(-1)) - 1], true);
            else {
              scene.rotate(code === 'ArrowUp' ? -0.15 : code === 'ArrowDown' ? 0.15 : 0, code === 'ArrowLeft' ? -0.15 : code === 'ArrowRight' ? 0.15 : 0);
              syncRotation();
            }
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
        const changeRotation = (): void => {
          if (paused || contextLost || ctx.signal.aborted) return;
          scene.setRotation(Number(view.rotation.value));
          syncRotation();
        };
        const changeLayout = (): void => {
          if (paused || contextLost || ctx.signal.aborted) return;
          const layout = view.layout.value as SceneLayout;
          const revision = ++layoutRevision;
          layoutPending = true;
          refreshOverlay();
          void ctx.state.transition('transition', 'demo:layout').then(() => {
            if (!ctx.signal.aborted && revision === layoutRevision) scene.setLayout(layout);
          }).catch(() => {
            // A terminal kernel rejects queued work; its host reports lifecycle failures.
          });
        };
        view.rotation.addEventListener('input', changeRotation);
        ctx.scope.defer(() => view.rotation.removeEventListener('input', changeRotation));
        view.layout.addEventListener('change', changeLayout);
        ctx.scope.defer(() => view.layout.removeEventListener('change', changeLayout));
        const changeWireframe = (): void => {
          if (ctx.signal.aborted) return;
          scene.setWireframe(view.wireframe.checked);
          // A late change during pause or graphics loss must still show the actual material state.
          view.wireframe.checked = scene.getWireframe();
        };
        const dismissDetails = (event: KeyboardEvent): void => {
          if (ctx.signal.aborted || !view.details.open || event.key !== 'Escape' || event.defaultPrevented ||
              event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
          event.preventDefault();
          view.details.open = false;
          if (view.details.isConnected && view.details.contains(document.activeElement)) {
            view.detailsSummary.focus({ preventScroll: true });
          }
        };
        view.wireframe.addEventListener('change', changeWireframe);
        ctx.scope.defer(() => view.wireframe.removeEventListener('change', changeWireframe));
        view.details.addEventListener('keydown', dismissDetails);
        ctx.scope.defer(() => view.details.removeEventListener('keydown', dismissDetails));
        loading.setStage('interaction', 1);
        loading.complete('Ready');
        select(saved.selected as Choice);
        refreshSceneControls();
        await ctx.state.transition('ready', 'demo:loaded');
      },
    }],
  });
  return kernel;
}

/** Host-owned controls survive disposal so recovery creates a fresh kernel. */
export function attachV02Controls(
  host: HTMLElement,
  kernel: Kernel,
  actions: { restart(failSetup: boolean): void; unmount(): void },
): () => Promise<void> {
  const scope = new ResourceScope();
  const root = document.createElement('div');
  host.classList.add('v02-controls-host');
  scope.defer(() => {
    if (!host.querySelector('.workbench-controls')) host.classList.remove('v02-controls-host');
  });
  root.className = 'workbench-controls';
  root.innerHTML = `<style>${styles}</style>
    <header class="workbench-heading"><div><div class="eyebrow">CREATE · COMBINE · EXPLORE</div>
      <h1>URK Playground <span class="version-badge">v0.2</span></h1>
      <p>A small scene. A world of possibilities. Make your next move.</p></div>
      <span class="workbench-badge">LIVE EXPERIENCE</span></header>
    <div class="toolbar" role="group" aria-label="Runtime controls"><span class="workspace-label">◆ &nbsp; Interactive objects</span>
      <button data-action="pause">Pause</button><button data-action="resume">Resume</button>
      <button data-action="restart">Start fresh</button></div>
    <aside class="workbench-inspector" aria-label="Runtime inspector"><h2>Inspector <span>LIVE</span></h2>
      <div class="metrics"><div><span>Runtime</span><output data-testid="v02-lifecycle"></output></div>
        <div><span>Experience</span><output data-testid="v02-phase"></output></div>
        <div><span>Frame loop</span><output data-testid="v02-frames"></output></div>
        <div><span>Owned surfaces</span><output data-testid="v02-owned"></output></div></div>
      <div class="inspector-note"><strong>Quiet by design.</strong><p>The scene redraws when you interact. Between changes, rendering rests.</p></div>
      <h3>Explore the lifecycle</h3><div class="inspector-actions"><button data-action="diagnostics" aria-pressed="false">Show diagnostics</button>
        <button data-action="failure">Try setup failure</button><button data-action="unmount">Unmount</button></div>
      <output data-testid="v02-message" role="status"></output><pre data-testid="v02-diagnostics">Diagnostics off</pre>
    </aside>`;
  host.append(root);
  scope.defer(() => {
    const focused = document.activeElement;
    const action = focused instanceof HTMLButtonElement && root.contains(focused) ? focused.dataset.action : undefined;
    root.remove();
    // Hosts attach replacement controls before cleanup; transfer only focus we just removed.
    if (!action || !host.isConnected || document.activeElement !== document.body) return;
    host.querySelector<HTMLButtonElement>(`[data-action="${CSS.escape(action)}"]`)?.focus({ preventScroll: true });
  });
  const output = (name: string): HTMLElement => root.querySelector(`[data-testid="v02-${name}"]`)!;
  const refresh = (): void => {
    const state = kernel.getLifecycleSnapshot().state;
    output('lifecycle').textContent = state;
    output('lifecycle').dataset.state = state;
    root.querySelector<HTMLButtonElement>('[data-action="pause"]')!.disabled = state !== 'running';
    root.querySelector<HTMLButtonElement>('[data-action="resume"]')!.disabled = state !== 'paused';
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
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    const action = button?.dataset.action;
    if (!action) return;
    const perform = async (): Promise<void> => {
      switch (action) {
        case 'pause':
        case 'resume': {
          const hadFocus = document.activeElement === button;
          if (action === 'pause') kernel.pause();
          else kernel.resume();
          const next = root.querySelector<HTMLButtonElement>(`[data-action="${action === 'pause' ? 'resume' : 'pause'}"]`)!;
          // Only a local action may transfer focus; lifecycle observers may have moved it elsewhere.
          if (hadFocus && root.isConnected && !next.disabled &&
              (document.activeElement === button || document.activeElement === document.body)) {
            next.focus({ preventScroll: true });
          }
          break;
        }
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
          const button = root.querySelector<HTMLButtonElement>('[data-action="diagnostics"]')!;
          button.textContent = detachDiagnostics ? 'Hide diagnostics' : 'Show diagnostics';
          button.setAttribute('aria-pressed', String(Boolean(detachDiagnostics)));
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
