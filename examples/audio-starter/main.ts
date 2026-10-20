/**
 * Company: EonHive Inc. | Title: Audio Embed Starter Host
 * Purpose: Register one audio source and own runtime pause, cleanup, and fresh starts.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-19
 * Notes: Vibe coded with Codex.
 */
import { createKernel, type Kernel } from '@urk/core';
import { AudioCapability, createAudioAdapter } from '@urk/adapters/audio';
import { mountAudioPreferences, mountAudioWidget } from './widget/index.js';
import studyUrl from '/audio/analysis.wav?url';

const read = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const host = read('audio-host');
const message = read('message');
const button = (id: string) => read<HTMLButtonElement>(id);
let kernel: Kernel | undefined;
let busy = false;
let pageActive = true;
let instance = 0;
let restorePending = false;

function sync(): void {
  const state = kernel?.getLifecycleSnapshot().state ?? 'created';
  read('lifecycle').textContent = state;
  read('instance').textContent = String(instance);
  button('pause').disabled = busy || state !== 'running';
  button('resume').disabled = busy || state !== 'paused';
  button('dispose').disabled = busy || !['running', 'paused'].includes(state);
  button('restart').disabled = busy;
}

function report(error: unknown): void {
  message.textContent = error instanceof Error ? error.message : String(error);
}

async function start(): Promise<void> {
  if (busy || !pageActive) return;
  restorePending = false;
  busy = true;
  sync();
  try {
    await kernel?.shutdown('audio-starter:restart');
    if (!pageActive) return;
    kernel = createKernel({
      frameMode: 'auto',
      adapters: [createAudioAdapter()],
      controllers: [{
        id: 'audio-embed-host',
        async start(ctx) {
          ctx.scope.defer(ctx.subscribeLifecycle(sync));
          const audio = ctx.require(AudioCapability);
          audio.registerTrack({ id: 'study', label: 'Three-band study', src: studyUrl, loop: true });
          audio.setVolume(0.6);
          const preferences = mountAudioPreferences(host, ctx, 'urk:audio-starter:reactions');
          const widget = await mountAudioWidget(host, ctx, {
            trackId: 'study', title: 'See your sound', localFiles: { defaultSource: studyUrl },
            reactions: preferences.restore(), onReactionsChange: preferences.changed,
          });
          preferences.changed(widget.getReactionSettings());
        },
      }],
    });
    await kernel.boot();
    await kernel.getContext().state.transition('ready', 'audio-starter:ready');
    instance++;
    message.textContent = 'Ready. Press Play in the widget. Runtime resume never starts sound.';
  } catch (error) {
    await kernel?.shutdown('audio-starter:failed').catch(report);
    throw error;
  } finally {
    busy = false;
    sync();
    if (restorePending && pageActive) {
      restorePending = false;
      void start().catch(report);
    }
  }
}

async function dispose(): Promise<void> {
  if (busy) return;
  busy = true;
  sync();
  try {
    await kernel?.shutdown('audio-starter:dispose');
    message.textContent = 'Disposed. Restart creates a fresh runtime; your page stays here.';
  } finally {
    busy = false;
    sync();
    if (restorePending && pageActive) {
      restorePending = false;
      void start().catch(report);
    }
  }
}

const listeners = new AbortController();
const on = (id: string, action: () => void | Promise<void>) =>
  button(id).addEventListener('click', () => {
    try { void Promise.resolve(action()).catch(report); }
    catch (error) { report(error); }
  }, { signal: listeners.signal });
on('pause', () => kernel?.pause('audio-starter:pause'));
on('resume', () => kernel?.resume('audio-starter:resume'));
on('dispose', dispose);
on('restart', start);
const stop = () => {
  pageActive = false;
  void kernel?.shutdown('audio-starter:pagehide').catch(report);
};
const restore = (event: PageTransitionEvent) => {
  if (event.persisted) {
    pageActive = true;
    // A page can enter history while its previous boot is still settling.
    if (busy) restorePending = true;
    else void start().catch(report);
  }
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', restore);
if (import.meta.hot) import.meta.hot.dispose(() => {
  listeners.abort();
  window.removeEventListener('pagehide', stop);
  window.removeEventListener('pageshow', restore);
  stop();
});
void start().catch(report);
