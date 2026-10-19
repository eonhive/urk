/**
 * Company: EonHive Inc. | Title: Motion Embed Starter Host
 * Purpose: Own one widget runtime with pause, cleanup, and fresh-kernel restart.
 * Author: Stan Nesi | Created: 2026-10-18 | Updated: 2026-10-18
 * Notes: Vibe coded with Codex.
 */
import { createKernel, type Kernel } from '@urk/core';
import { createMotionAdapter } from '@urk/adapters/motion';
import { mountMotionWidget, mountWidgetPreferences, type MotionWidget } from './widget/index.js';

const read = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const host = read('motion-host');
const message = read('message');
const button = (id: string) => read<HTMLButtonElement>(id);
let kernel: Kernel | undefined;
let widget: MotionWidget | undefined;
let busy = false;
let instance = 0;
let pageActive = true;

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
  busy = true;
  sync();
  try {
    await kernel?.shutdown('starter:restart');
    // Page exit can happen while an earlier kernel's cleanup is awaited.
    if (!pageActive) return;
    widget = undefined;
    kernel = createKernel({
      frameMode: 'auto',
      adapters: [createMotionAdapter()],
      controllers: [
        {
          id: 'embed-host',
          async start(ctx) {
            ctx.scope.defer(ctx.subscribeLifecycle(sync));
            // The page owns saving consent and its key. Remove this helper to omit persistence.
            const preferences = mountWidgetPreferences(host, ctx.scope, 'my-site:motion-widget');
            widget = await mountMotionWidget(host, ctx, {
              title: 'Your signal',
              tone: 'cyan',
              ...preferences.restore(),
              onSettingsChange: preferences.changed,
            });
            preferences.changed(widget.getSnapshot());
          },
        },
      ],
    });
    await kernel.boot();
    await kernel.getContext().state.transition('ready', 'starter:ready');
    instance++;
    // Replay settles with an outcome; it does not keep the start hook pending.
    void widget!.replay().catch(report);
    message.textContent = 'Ready. Try the widget controls, or pause the entire runtime.';
  } catch (error) {
    await kernel?.shutdown('starter:failed').catch(report);
    widget = undefined;
    throw error;
  } finally {
    busy = false;
    sync();
  }
}

async function dispose(): Promise<void> {
  if (busy) return;
  busy = true;
  sync();
  try {
    await kernel?.shutdown('starter:dispose');
    widget = undefined;
    message.textContent = 'Disposed. Your page content stays here. Restart creates a fresh kernel.';
  } finally {
    busy = false;
    sync();
  }
}

const listeners = new AbortController();
const on = (id: string, action: () => void | Promise<void>) =>
  button(id).addEventListener(
    'click',
    () => {
      void Promise.resolve().then(action).catch(report);
    },
    { signal: listeners.signal },
  );
on('pause', () => {
  kernel?.pause('starter:pause');
  sync();
});
on('resume', () => {
  kernel?.resume('starter:resume');
  sync();
});
on('dispose', dispose);
on('restart', start);

const stop = () => {
  pageActive = false;
  void kernel?.shutdown('starter:pagehide').catch(report);
};
const restore = (event: PageTransitionEvent) => {
  if (event.persisted) {
    pageActive = true;
    void start().catch(report);
  }
};
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', restore);
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    listeners.abort();
    window.removeEventListener('pagehide', stop);
    window.removeEventListener('pageshow', restore);
    stop();
  });
void start().catch(report);
