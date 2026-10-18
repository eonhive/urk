/**
 * Company: EonHive Inc.
 * Title: Public Audio Proof Mount
 * Purpose: Share audio analysis, reactive visuals, and runtime ownership across standalone and website hosts.
 * Author: Stan Nesi
 * Created: 2026-09-21
 * Updated: 2026-10-17
 * Notes: Vibe coded with Codex.
 */
import { createKernel, ResourceScope } from '@urk/core';
import { AudioCapability, createAudioAdapter } from '@urk/adapters/audio';
import { createMotionAdapter } from '@urk/adapters/motion';
import { mountMediaInspector } from '../media/inspector.js';
import { createAudioView } from './view.js';
import type { mountAudioScene } from './scene.js';

export interface AudioLabOptions { assetBaseUrl?: string }

export function mountAudioProof(host: HTMLElement, options: AudioLabOptions = {}) {
  const view = createAudioView(host);
  const { get } = view;
  const status = get('status');
  const track = get<HTMLSelectElement>('track');
  const enabled = get<HTMLInputElement>('enabled');
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const mountEvents = new AbortController();
  const base = new URL(options.assetBaseUrl ?? '/audio/', document.baseURI);
  let closed = false;
  let restarting = false;
  let offLifecycle = () => {};

  function makeKernel() {
    return createKernel({
      id: 'urk-audio-lab', frameMode: 'auto',
      services: { 'three:host': get('scene') },
      adapters: [createAudioAdapter(), createMotionAdapter()],
      controllers: [{
        id: 'audio-analysis-controller',
        async start(ctx) {
          const audio = ctx.require(AudioCapability);
          for (const name of ['analysis', 'bed', 'pulse', 'confirm']) audio.registerTrack({
            id: name, label: name, src: new URL(`${name}.wav`, base).href, loop: name !== 'confirm',
          });
          track.value = 'analysis';
          enabled.checked = true;
          get<HTMLSelectElement>('fft').value = '2048';
          get<HTMLInputElement>('smoothing').value = '0.8';
          get<HTMLSelectElement>('layout').value = 'orbit';
          get<HTMLInputElement>('volume').value = '0.6';
          audio.setVolume(0.6);
          audio.analysis.configure();
          let scene: Awaited<ReturnType<typeof mountAudioScene>> | undefined;
          let latest = audio.analysis.read();
          let releaseFrame: (() => void) | undefined;
          let request = 0;
          const drawScene = () => {
            scene?.render(latest, preference.matches);
            get('frames').textContent = ctx.scheduler.isRunning() ? 'running' : 'idle';
          };
          const render = () => {
            latest = audio.analysis.read();
            view.render(latest);
            drawScene();
            get('frames').textContent = ctx.scheduler.isRunning() ? 'running' : 'idle';
          };
          const sync = () => {
            const transport = audio.getSnapshot();
            const active = ctx.getLifecycleSnapshot().state === 'running' && !ctx.signal.aborted;
            if (active && transport.status === 'playing' && audio.analysis.enabled) {
              releaseFrame ??= ctx.registerFrameWork(render);
            } else {
              releaseFrame?.();
              releaseFrame = undefined;
            }
            get('mute').textContent = transport.muted ? 'Unmute' : 'Mute';
            get('mute').setAttribute('aria-pressed', String(transport.muted));
            render();
          };
          ctx.scope.defer(() => releaseFrame?.());
          ctx.scope.defer(audio.subscribe(transport => {
            status.textContent = transport.errorMessage ?? `Audio ${transport.status}.`;
            sync();
          }));
          ctx.scope.defer(ctx.subscribeLifecycle(state => {
            if (state.state !== 'running') { request++; audio.pause(); }
            sync();
          }));
          const report = (error: unknown) => {
            if (ctx.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
            status.textContent = error instanceof Error ? error.message : String(error);
            sync();
          };
          const on = (target: EventTarget, event: string, action: () => void | Promise<void>) => {
            target.addEventListener(event, () => {
              try {
                // Native playback and context resume both start in the original gesture.
                void Promise.resolve(action()).catch(report);
              } catch (error) { report(error); }
            }, { signal: ctx.signal });
          };
          const settings = () => ({ fftSize: Number(get<HTMLSelectElement>('fft').value), smoothing: Number(get<HTMLInputElement>('smoothing').value) });
          const play = async () => {
            if (ctx.getLifecycleSnapshot().state !== 'running') return;
            const current = ++request;
            try {
              const ready = enabled.checked ? audio.analysis.enable(settings()) : Promise.resolve();
              await Promise.all([ready, audio.play(track.value)]);
              if (current === request && !ctx.signal.aborted) sync();
            } catch (error) {
              if (current !== request || ctx.signal.aborted) return;
              enabled.checked = audio.analysis.enabled;
              throw error;
            }
          };
          const pause = () => { request++; audio.pause(); };
          const stop = () => { request++; audio.stop(); };
          on(get('play'), 'click', play);
          on(get('pause'), 'click', pause);
          on(get('stop'), 'click', stop);
          on(get('restart'), 'click', () => { stop(); return play(); });
          on(track, 'change', () => { stop(); status.textContent = 'Source selected. Press Play.'; });
          on(get('mute'), 'click', () => audio.setMuted(!audio.getSnapshot().muted));
          on(get('volume'), 'input', () => audio.setVolume(Number(get<HTMLInputElement>('volume').value)));
          on(enabled, 'change', async () => {
            try {
              if (enabled.checked) await audio.analysis.enable(settings());
              else audio.analysis.disable();
            } finally {
              if (!ctx.signal.aborted) { enabled.checked = audio.analysis.enabled; sync(); }
            }
          });
          on(get('fft'), 'change', () => { audio.analysis.configure(settings()); render(); });
          on(get('smoothing'), 'input', () => audio.analysis.configure(settings()));
          on(get('layout'), 'change', () => {
            scene?.setLayout(get<HTMLSelectElement>('layout').value);
          });
          on(preference, 'change', drawScene);
          on(document, 'visibilitychange', () => {
            if (document.hidden) { pause(); status.textContent = 'Tab hidden. Press Play when you return.'; }
          });
          ctx.scope.defer(() => {
            audio.stop();
            audio.analysis.disable();
            view.render(audio.analysis.read());
          });
          mountMediaInspector(ctx, kernel, get<HTMLButtonElement>('inspect'), get('inspector'));

          // Reuse the existing optional-scene ownership pattern; graphics failure stays local.
          const graphics = new ResourceScope();
          ctx.scope.defer(() => graphics.dispose());
          try {
            const module = await import('./scene.js');
            if (ctx.signal.aborted) return;
            scene = await module.mountAudioScene({ ...ctx, scope: graphics }, drawScene, get('scene-status'));
            drawScene();
          } catch (error) {
            await graphics.dispose();
            if (ctx.signal.aborted) return;
            get('scene-status').textContent = '3D is unavailable. Audio, waveform, spectrum, and meters still work.';
            get<HTMLSelectElement>('layout').disabled = true;
            view.root.dataset.graphics = 'unavailable';
          }
          if (ctx.signal.aborted) return;
          status.textContent = 'Ready. Press Play to hear the three-band study.';
          ctx.state.setPhase('ready', 'audio-lab:ready');
          sync();
        },
      }],
    });
  }

  let kernel = makeKernel();
  function observe() {
    const sync = () => {
      const state = kernel.getLifecycleSnapshot().state;
      get('lifecycle').textContent = state;
      get('frames').textContent = kernel.getContext().scheduler.isRunning() ? 'running' : 'idle';
      for (const control of view.root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('button[data-audio], input[data-audio], select[data-audio]')) {
        if (['fresh', 'runtime', 'shutdown', 'inspect'].includes(control.dataset.audio ?? '')) continue;
        control.disabled = state !== 'running';
      }
      get<HTMLSelectElement>('layout').disabled = state !== 'running' || view.root.dataset.graphics === 'unavailable';
      get('runtime').textContent = state === 'paused' ? 'Resume runtime' : 'Pause runtime';
      get<HTMLButtonElement>('runtime').disabled = state !== 'running' && state !== 'paused';
      get<HTMLButtonElement>('shutdown').disabled = state === 'disposing' || state === 'disposed';
      get<HTMLButtonElement>('inspect').disabled = state !== 'running' && state !== 'paused';
      if (state === 'disposed') status.textContent = 'Audio and graphics released. Start fresh to listen again.';
    };
    offLifecycle = kernel.subscribeLifecycle(sync);
    sync();
  }
  const report = (error: unknown) => { if (!closed) status.textContent = String(error); };
  const on = (name: string, action: () => void | Promise<void>) => {
    get(name).addEventListener('click', () => {
      try { void Promise.resolve(action()).catch(report); } catch (error) { report(error); }
    }, { signal: mountEvents.signal });
  };
  observe();
  const ready = kernel.boot().catch(report);
  on('runtime', () => {
    if (kernel.getLifecycleSnapshot().state === 'paused') kernel.resume();
    else kernel.pause();
  });
  on('shutdown', () => kernel.shutdown('audio-lab:shutdown'));
  const restart = async () => {
    if (closed || restarting) return;
    restarting = true;
    get<HTMLButtonElement>('fresh').disabled = true;
    try {
      await kernel.shutdown('audio-lab:restart');
      offLifecycle();
      if (closed) return;
      delete view.root.dataset.graphics;
      kernel = makeKernel();
      observe();
      await kernel.boot();
    } finally {
      restarting = false;
      get<HTMLButtonElement>('fresh').disabled = false;
    }
  };
  on('fresh', restart);
  let teardown: Promise<void> | undefined;
  return {
    get kernel() { return kernel; }, ready, restart,
    teardown() {
      if (!teardown) {
        closed = true;
        mountEvents.abort();
        offLifecycle();
        teardown = kernel.shutdown('audio-lab:unmount').finally(() => view.dispose());
      }
      return teardown;
    },
  };
}

export const mountAudioProofExample = (host: HTMLElement) => mountAudioProof(host);
