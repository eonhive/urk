/**
 * Company: EonHive Inc. | Title: Motion Playground Controller
 * Purpose: Tween a borrowed scene object and demonstrate explicit playback and owner lifetimes.
 * Author: Stan Nesi | Created: 2026-10-16 | Updated: 2026-10-16
 * Notes: Vibe coded with Codex.
 */
import { createKernel, ResourceScope, type Kernel } from '@urk/core';
import { createMotionAdapter, MotionCapability, type MotionEasing, type MotionPlayback, type ScopedMotion } from '@urk/adapters/motion';
import { createThreeAdapter, ThreeCapability } from '@urk/adapters/three';
import * as THREE from 'three';

const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => get<HTMLButtonElement>(id);
const host = get('scene');
const caption = get('caption');
const result = get('result');
const duration = get<HTMLInputElement>('duration');
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let kernel: Kernel;
let motion: ScopedMotion | undefined;
let scope: ResourceScope | undefined;
let playback: MotionPlayback | undefined;
let mesh: THREE.Mesh | undefined;
let tweenPaused = false;
let busy = false;
let launch = (_x: number) => {};
let recreateOwner = () => {};

function syncView() {
  const state = kernel.getLifecycleSnapshot().state;
  const available = state === 'running' || state === 'paused';
  get('lifecycle').textContent = state;
  get('active').textContent = String(motion?.activeCount ?? 0);
  get('frames').textContent = kernel.getContext().scheduler.isRunning() ? 'running' : 'idle';
  get('position').textContent = (mesh?.position.x ?? 0).toFixed(3);
  button('pause-runtime').textContent = state === 'paused' ? 'Resume runtime' : 'Pause runtime';
  button('pause-runtime').disabled = !available || busy;
  button('pause-tween').textContent = tweenPaused ? 'Resume tween' : 'Pause tween';
  for (const id of ['pause-tween', 'finish', 'cancel']) button(id).disabled = !playback || !available || busy;
  for (const id of ['left', 'right', 'dispose-owner']) button(id).disabled = !motion || !available || busy;
  button('new-owner').disabled = Boolean(motion) || !available || busy;
  button('destroy').disabled = !available || busy;
  button('fresh').disabled = busy;
}

async function startFresh() {
  if (busy) return;
  busy = true;
  if (kernel) { syncView(); await kernel.shutdown(); }
  motion = undefined;
  playback = undefined;
  mesh = undefined;
  scope = undefined;
  tweenPaused = false;
  kernel = createKernel({
    frameMode: 'auto', services: { 'three:host': host },
    adapters: [createMotionAdapter(), createThreeAdapter()],
    controllers: [{
      id: 'motion-playground',
      start(ctx) {
        const scene = ctx.require(ThreeCapability);
        const geometry = new THREE.IcosahedronGeometry(0.7, 0);
        ctx.scope.defer(() => geometry.dispose());
        const material = new THREE.MeshNormalMaterial({ flatShading: true });
        ctx.scope.defer(() => material.dispose());
        const object = new THREE.Mesh(geometry, material);
        object.rotation.set(0.3, 0.4, 0);
        mesh = object;
        scene.getScene().add(object);
        ctx.scope.defer(() => { scene.getScene().remove(object); });
        ctx.scope.defer(() => scope?.dispose());
        const draw = () => {
          if (ctx.signal.aborted) return;
          scene.render();
          syncView();
        };
        ctx.scope.defer(ctx.events.on('three:resize', draw));
        ctx.scope.defer(ctx.subscribeLifecycle(syncView));
        recreateOwner = () => {
          scope = new ResourceScope();
          motion = ctx.require(MotionCapability).scoped(scope);
          result.textContent = 'Motion owner ready.';
          syncView();
        };
        recreateOwner();
        launch = x => {
          if (!motion) return;
          caption.textContent = x < 0 ? 'Moving left.' : 'Moving right.';
          const durationMs = get<HTMLInputElement>('instant').checked ? 0 : Number(duration.value);
          void motion.animate(caption, [{ opacity: 0.25 }, { opacity: 1 }], { durationMs: 180 }).finished.then(() => {
            if (!ctx.signal.aborted) syncView();
          });
          const current = motion.tween(object.position, { x }, {
            durationMs, easing: get<HTMLSelectElement>('easing').value as MotionEasing, onUpdate: draw,
          });
          playback = current;
          tweenPaused = false;
          result.textContent = 'Moving. Choose another destination to interrupt.';
          void current.finished.then(outcome => {
            if (ctx.signal.aborted || playback !== current) return;
            playback = undefined;
            tweenPaused = false;
            result.textContent = outcome.status === 'failed' ? String(outcome.error) : `Tween ${outcome.status}.`;
            syncView();
          });
          syncView();
        };
        draw();
      },
    }],
  });
  try {
    await kernel.boot();
    result.textContent = 'Ready. Choose a direction.';
  } catch (error) {
    result.textContent = `Scene unavailable: ${String(error)}`;
  } finally {
    busy = false;
    syncView();
  }
}

const listeners = new AbortController();
const on = (id: string, action: () => void | Promise<void>) => button(id).addEventListener('click', () => {
  void Promise.resolve().then(action).catch(error => { result.textContent = String(error); });
}, { signal: listeners.signal });
on('left', () => launch(-1.4));
on('right', () => launch(1.4));
on('pause-runtime', () => {
  if (kernel.getLifecycleSnapshot().state === 'paused') kernel.resume();
  else kernel.pause();
  syncView();
});
on('pause-tween', () => {
  tweenPaused = !tweenPaused;
  if (tweenPaused) playback?.pause();
  else playback?.resume();
  syncView();
});
on('finish', () => playback?.finish());
on('cancel', () => playback?.cancel('user'));
on('dispose-owner', async () => {
  await scope?.dispose();
  motion = undefined;
  result.textContent = 'Motion owner disposed. The scene is still available.';
  syncView();
});
on('new-owner', () => recreateOwner());
on('destroy', async () => { await kernel.shutdown(); syncView(); });
on('fresh', startFresh);
duration.addEventListener('input', () => { get('duration-label').textContent = `${duration.value} ms`; }, { signal: listeners.signal });
const syncPreference = () => { get('preference').textContent = `System reduced motion: ${preference.matches ? 'on' : 'off'}`; };
preference.addEventListener('change', syncPreference);
syncPreference();
const stop = () => { void kernel?.shutdown().catch(error => { result.textContent = String(error); }); };
const restore = (event: PageTransitionEvent) => { if (event.persisted) void startFresh(); };
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', restore);
if (import.meta.hot) import.meta.hot.dispose(() => {
  listeners.abort();
  preference.removeEventListener('change', syncPreference);
  window.removeEventListener('pagehide', stop);
  window.removeEventListener('pageshow', restore);
  stop();
});
void startFresh();
